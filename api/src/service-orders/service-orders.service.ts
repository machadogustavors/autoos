import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceOrderItemType, ServiceOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { IdempotencyService } from '../common/idempotency.service';
import { paginate, resolveLimit } from '../common/pagination';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { CreateServiceOrderItemDto } from './dto/create-service-order-item.dto';
import { UpdateServiceOrderItemDto } from './dto/update-service-order-item.dto';
import { CreateTelemetrySnapshotDto } from './dto/create-telemetry-snapshot.dto';

// RF-10 — máquina de estados. completed/cancelled são terminais.
const ALLOWED_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  [ServiceOrderStatus.open]: [
    ServiceOrderStatus.in_progress,
    ServiceOrderStatus.cancelled,
  ],
  [ServiceOrderStatus.in_progress]: [
    ServiceOrderStatus.completed,
    ServiceOrderStatus.cancelled,
  ],
  [ServiceOrderStatus.completed]: [],
  [ServiceOrderStatus.cancelled]: [],
};

// Ordens ativas — as únicas que impedem uma segunda OS no mesmo veículo (RF-07)
// e as únicas que aparecem no pátio por padrão (RF-05).
const ACTIVE_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.open,
  ServiceOrderStatus.in_progress,
];

const DETAIL_INCLUDE = {
  vehicle: true,
  customer: true,
  items: true,
  telemetrySnapshots: { orderBy: { capturedAt: 'desc' as const }, take: 1 },
};

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // RF-07. Idempotente (RF-08/RNF-06).
  async create(
    userId: string,
    idempotencyKey: string,
    dto: CreateServiceOrderDto,
  ) {
    return this.idempotency.run(
      idempotencyKey,
      userId,
      'postServiceOrder',
      (resourceId) => this.findDetailOrNull(resourceId),
      async () => {
        const customer = await this.prisma.customer.findUnique({
          where: { id: dto.customerId },
        });
        if (!customer) {
          throw new NotFoundException('Cliente não encontrado.');
        }

        await this.vehiclesService.findOneOrThrow(dto.vehicleId);

        const activeOrder = await this.prisma.serviceOrder.findFirst({
          where: { vehicleId: dto.vehicleId, status: { in: ACTIVE_STATUSES } },
        });
        if (activeOrder) {
          throw new ConflictException(
            'Este veículo já tem uma OS em andamento.',
          );
        }

        const created = await this.prisma.serviceOrder.create({
          data: {
            customerId: dto.customerId,
            vehicleId: dto.vehicleId,
            description: dto.description,
          },
        });

        return this.getDetail(created.id);
      },
    );
  }

  // RF-05 — pátio. Sem filtro = só o que está em aberto.
  async findMany(
    status?: ServiceOrderStatus[],
    after?: string,
    limit?: number,
  ) {
    const take = resolveLimit(limit);
    const statusFilter = status && status.length > 0 ? status : ACTIVE_STATUSES;

    const rows = await this.prisma.serviceOrder.findMany({
      where: { status: { in: statusFilter } },
      include: DETAIL_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });

    const page = paginate(rows, take);
    return {
      items: page.items.map((row) => this.toCard(row)),
      paging: page.paging,
    };
  }

  // RF-18 — histórico do veículo (usado pelo VehiclesController).
  async findByVehicle(vehicleId: string, after?: string, limit?: number) {
    await this.vehiclesService.findOneOrThrow(vehicleId);
    const take = resolveLimit(limit);

    const rows = await this.prisma.serviceOrder.findMany({
      where: { vehicleId },
      include: DETAIL_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });

    const page = paginate(rows, take);
    return {
      items: page.items.map((row) => this.toCard(row)),
      paging: page.paging,
    };
  }

  // RF-09.
  async getDetail(id: string) {
    const order = await this.fetchDetail(id);
    if (!order) {
      throw new NotFoundException('OS não encontrada.');
    }
    return this.toDetail(order);
  }

  // RF-10.
  async updateStatus(id: string, status: ServiceOrderStatus) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('OS não encontrada.');
    }

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(status)) {
      throw new ConflictException(
        `Transição de "${order.status}" para "${status}" não é permitida.`,
      );
    }

    await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status,
        completedAt:
          status === ServiceOrderStatus.completed
            ? new Date()
            : order.completedAt,
      },
    });

    return this.getDetail(id);
  }

  // RF-11/RF-11a. Idempotente (RNF-06).
  async addItem(
    userId: string,
    orderId: string,
    idempotencyKey: string,
    dto: CreateServiceOrderItemDto,
  ) {
    return this.idempotency.run(
      idempotencyKey,
      userId,
      'postServiceOrderItem',
      (resourceId) =>
        this.prisma.serviceOrderItem.findUnique({ where: { id: resourceId } }),
      async () => {
        const order = await this.prisma.serviceOrder.findUnique({
          where: { id: orderId },
        });
        if (!order) {
          throw new NotFoundException('OS não encontrada.');
        }
        if (!ACTIVE_STATUSES.includes(order.status)) {
          throw new ConflictException(
            'OS concluída ou cancelada não recebe novo item.',
          );
        }

        if (dto.type === ServiceOrderItemType.service && dto.productId) {
          throw new BadRequestException(
            'Item de serviço não pode referenciar productId.',
          );
        }

        if (dto.productId) {
          return this.createItemWithStockDeduction(orderId, dto.productId, dto);
        }

        return this.prisma.serviceOrderItem.create({
          data: {
            serviceOrderId: orderId,
            type: dto.type,
            description: dto.description,
            quantity: dto.quantity,
          },
        });
      },
    );
  }

  // RF-11.
  async updateItem(
    orderId: string,
    itemId: string,
    dto: UpdateServiceOrderItemDto,
  ) {
    await this.findItemOrThrow(orderId, itemId);

    return this.prisma.serviceOrderItem.update({
      where: { id: itemId },
      data: { description: dto.description, quantity: dto.quantity },
    });
  }

  // RF-11.
  async removeItem(orderId: string, itemId: string) {
    await this.findItemOrThrow(orderId, itemId);
    await this.prisma.serviceOrderItem.delete({ where: { id: itemId } });
  }

  // RF-13 — snapshot pontual anexado à OS. A quilometragem da leitura
  // passa a ser a referência do veículo (substitui o valor cadastrado
  // manualmente em RF-04). O fluxo contínuo/bruto (RF-14) não passa por
  // aqui — vai direto do app pro LARCC via MQTT, fora da API.
  async addTelemetrySnapshot(orderId: string, dto: CreateTelemetrySnapshotDto) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('OS não encontrada.');
    }

    const [snapshot] = await this.prisma.$transaction([
      this.prisma.telemetrySnapshot.create({
        data: {
          serviceOrderId: orderId,
          mileage: dto.mileage,
          engineTemperature: dto.engineTemperature,
          batteryVoltage: dto.batteryVoltage,
          dtcCodes: dto.dtcCodes ?? [],
          capturedAt: new Date(dto.capturedAt),
        },
      }),
      this.prisma.vehicle.update({
        where: { id: order.vehicleId },
        data: { referenceMileage: dto.mileage },
      }),
    ]);

    return snapshot;
  }

  private async findItemOrThrow(orderId: string, itemId: string) {
    const item = await this.prisma.serviceOrderItem.findFirst({
      where: { id: itemId, serviceOrderId: orderId },
    });
    if (!item) {
      throw new NotFoundException('Item não encontrado.');
    }
    return item;
  }

  // RF-11a — baixa transacional e à prova de corrida: o WHERE
  // `stockQuantity >= quantity` garante que dois pedidos concorrentes não
  // derrubem o estoque abaixo de zero (RNF-16).
  private async createItemWithStockDeduction(
    orderId: string,
    productId: string,
    dto: CreateServiceOrderItemDto,
  ) {
    const quantity = dto.quantity ?? 1;

    return this.prisma.$transaction(async (tx) => {
      const decremented = await tx.product.updateMany({
        where: { id: productId, stockQuantity: { gte: quantity } },
        data: { stockQuantity: { decrement: quantity } },
      });

      if (decremented.count === 0) {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });
        if (!product) {
          throw new NotFoundException('Peça não encontrada no estoque.');
        }
        throw new ConflictException({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Estoque insuficiente. Disponível: ${product.stockQuantity}.`,
          },
        });
      }

      return tx.serviceOrderItem.create({
        data: {
          serviceOrderId: orderId,
          type: dto.type,
          description: dto.description,
          productId,
          quantity: dto.quantity,
        },
      });
    });
  }

  private fetchDetail(id: string) {
    return this.prisma.serviceOrder.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
  }

  private async findDetailOrNull(id: string) {
    const order = await this.fetchDetail(id);
    return order ? this.toDetail(order) : null;
  }

  private toCard(order: {
    id: string;
    status: ServiceOrderStatus;
    createdAt: Date;
    vehicle: { plate: string; brand: string | null; model: string | null };
    customer: { name: string };
    telemetrySnapshots: { dtcCodes: unknown }[];
  }) {
    const lastSnapshot = order.telemetrySnapshots[0];
    const dtcCodes = Array.isArray(lastSnapshot?.dtcCodes)
      ? lastSnapshot.dtcCodes
      : [];

    return {
      id: order.id,
      status: order.status,
      plate: order.vehicle.plate,
      customerName: order.customer.name,
      brand: order.vehicle.brand,
      model: order.vehicle.model,
      hasDtcOnLastReading: dtcCodes.length > 0,
      createdAt: order.createdAt,
    };
  }

  private toDetail(
    order: Parameters<ServiceOrdersService['toCard']>[0] & {
      description: string | null;
      completedAt: Date | null;
      items: unknown[];
      telemetrySnapshots: unknown[];
    },
  ) {
    return {
      ...this.toCard(order),
      description: order.description,
      items: order.items,
      lastTelemetry: order.telemetrySnapshots[0] ?? null,
      completedAt: order.completedAt,
    };
  }
}
