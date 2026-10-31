import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceOrderItemType, ServiceOrderStatus } from '@prisma/client';
import { ServiceOrdersService } from './service-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { IdempotencyService } from '../common/idempotency.service';

function baseOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'os-1',
    status: ServiceOrderStatus.open,
    createdAt: new Date('2026-10-14T13:00:00-03:00'),
    description: null,
    completedAt: null,
    vehicle: { plate: 'ABC1D23', brand: 'Volkswagen', model: 'Gol' },
    customer: { name: 'Wilson Machado' },
    items: [],
    telemetrySnapshots: [],
    ...overrides,
  };
}

interface MockPrisma {
  customer: { findUnique: jest.Mock };
  serviceOrder: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  serviceOrderItem: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  idempotencyKey: { findUnique: jest.Mock; create: jest.Mock };
  product: { updateMany: jest.Mock; findUnique: jest.Mock };
  vehicle: { update: jest.Mock };
  telemetrySnapshot: { create: jest.Mock };
  $transaction: jest.Mock;
}

describe('ServiceOrdersService', () => {
  let service: ServiceOrdersService;
  let prisma: MockPrisma;
  let vehiclesService: { findOneOrThrow: jest.Mock };
  let idempotency: IdempotencyService;

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn() },
      serviceOrder: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      serviceOrderItem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      product: { updateMany: jest.fn(), findUnique: jest.fn() },
      vehicle: { update: jest.fn() },
      telemetrySnapshot: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    // $transaction aparece nas duas formas do Prisma: callback (baixa de
    // estoque) e array de promises (snapshot de telemetria + atualização
    // de km do veículo).
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: MockPrisma) => unknown)(prisma),
    );

    vehiclesService = {
      findOneOrThrow: jest.fn().mockResolvedValue({ id: 'v1' }),
    };
    idempotency = new IdempotencyService(prisma as unknown as PrismaService);

    service = new ServiceOrdersService(
      prisma as unknown as PrismaService,
      vehiclesService as unknown as VehiclesService,
      idempotency,
    );
  });

  describe('create (RF-07)', () => {
    const dto = {
      customerId: 'c1',
      vehicleId: 'v1',
      description: 'Troca de óleo',
    };

    it('rejects when the customer does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', 'key-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a second active order for the same vehicle', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.serviceOrder.findFirst.mockResolvedValue(baseOrderRow());

      await expect(
        service.create('user-1', 'key-1', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
    });

    it('creates the order and returns its detail', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.serviceOrder.findFirst.mockResolvedValue(null);
      prisma.serviceOrder.create.mockResolvedValue({ id: 'os-1' });
      prisma.serviceOrder.findUnique.mockResolvedValue(baseOrderRow());

      const result = await service.create('user-1', 'key-1', dto);

      expect(result.id).toBe('os-1');
      expect(result.status).toBe(ServiceOrderStatus.open);
      expect(prisma.idempotencyKey.create).toHaveBeenCalled();
    });

    it('returns the same order on a repeated Idempotency-Key without creating twice', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        resourceId: 'os-1',
      });
      prisma.serviceOrder.findUnique.mockResolvedValue(baseOrderRow());

      const result = await service.create('user-1', 'key-1', dto);

      expect(result.id).toBe('os-1');
      expect(prisma.customer.findUnique).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus (RF-10)', () => {
    it('allows open -> in_progress', async () => {
      prisma.serviceOrder.findUnique
        .mockResolvedValueOnce(
          baseOrderRow({ status: ServiceOrderStatus.open }),
        )
        .mockResolvedValueOnce(
          baseOrderRow({ status: ServiceOrderStatus.in_progress }),
        );

      const result = await service.updateStatus(
        'os-1',
        ServiceOrderStatus.in_progress,
      );

      expect(result.status).toBe(ServiceOrderStatus.in_progress);
    });

    it('rejects completed -> open (terminal state)', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(
        baseOrderRow({ status: ServiceOrderStatus.completed }),
      );

      await expect(
        service.updateStatus('os-1', ServiceOrderStatus.open),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('rejects open -> completed directly (must pass through in_progress)', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(
        baseOrderRow({ status: ServiceOrderStatus.open }),
      );

      await expect(
        service.updateStatus('os-1', ServiceOrderStatus.completed),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('sets completedAt when moving to completed', async () => {
      prisma.serviceOrder.findUnique
        .mockResolvedValueOnce(
          baseOrderRow({ status: ServiceOrderStatus.in_progress }),
        )
        .mockResolvedValueOnce(
          baseOrderRow({ status: ServiceOrderStatus.completed }),
        );

      await service.updateStatus('os-1', ServiceOrderStatus.completed);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.any() é `any` no @types/jest */
      expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });

  describe('addItem (RF-11/RF-11a)', () => {
    it('rejects adding an item to a completed order', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(
        baseOrderRow({ status: ServiceOrderStatus.completed }),
      );

      await expect(
        service.addItem('user-1', 'os-1', 'key-1', {
          type: ServiceOrderItemType.service,
          description: 'Troca',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a service item that references a productId', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(baseOrderRow());

      await expect(
        service.addItem('user-1', 'os-1', 'key-1', {
          type: ServiceOrderItemType.service,
          description: 'Alinhamento',
          productId: 'p1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a plain item (no productId) without touching stock', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(baseOrderRow());
      prisma.serviceOrderItem.create.mockResolvedValue({ id: 'item-1' });

      await service.addItem('user-1', 'os-1', 'key-1', {
        type: ServiceOrderItemType.service,
        description: 'Alinhamento',
      });

      expect(prisma.product.updateMany).not.toHaveBeenCalled();
      expect(prisma.serviceOrderItem.create).toHaveBeenCalled();
    });

    it('deducts stock atomically when adding a part item with productId', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(baseOrderRow());
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.serviceOrderItem.create.mockResolvedValue({ id: 'item-1' });

      await service.addItem('user-1', 'os-1', 'key-1', {
        type: ServiceOrderItemType.part,
        description: 'Filtro de óleo',
        productId: 'p1',
        quantity: 2,
      });

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', stockQuantity: { gte: 2 } },
        data: { stockQuantity: { decrement: 2 } },
      });
    });

    it('throws INSUFFICIENT_STOCK when the atomic decrement affects zero rows', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(baseOrderRow());
      prisma.product.updateMany.mockResolvedValue({ count: 0 });
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        stockQuantity: 1,
      });

      await expect(
        service.addItem('user-1', 'os-1', 'key-1', {
          type: ServiceOrderItemType.part,
          description: 'Filtro de óleo',
          productId: 'p1',
          quantity: 5,
        }),
      ).rejects.toMatchObject({
        response: { error: { code: 'INSUFFICIENT_STOCK' } },
      });
      expect(prisma.serviceOrderItem.create).not.toHaveBeenCalled();
    });
  });

  describe('addTelemetrySnapshot (RF-13)', () => {
    const dto = {
      mileage: 84213,
      engineTemperature: 91,
      batteryVoltage: 12.6,
      dtcCodes: ['P0301'],
      capturedAt: '2026-10-14T14:32:01-03:00',
    };

    it('rejects when the order does not exist', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.addTelemetrySnapshot('os-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates the snapshot and updates the vehicle reference mileage in the same transaction', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(
        baseOrderRow({ vehicleId: 'v1' }),
      );
      prisma.telemetrySnapshot.create.mockResolvedValue({
        id: 'snap-1',
        ...dto,
      });
      prisma.vehicle.update.mockResolvedValue({
        id: 'v1',
        referenceMileage: dto.mileage,
      });

      const result = await service.addTelemetrySnapshot('os-1', dto);

      expect(result.id).toBe('snap-1');
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { referenceMileage: dto.mileage },
      });
    });

    it('defaults dtcCodes to an empty array, never omitting the field', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(
        baseOrderRow({ vehicleId: 'v1' }),
      );
      prisma.telemetrySnapshot.create.mockResolvedValue({ id: 'snap-2' });
      prisma.vehicle.update.mockResolvedValue({});

      await service.addTelemetrySnapshot('os-1', {
        mileage: 100,
        capturedAt: dto.capturedAt,
      });

      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() é `any` no @types/jest */
      expect(prisma.telemetrySnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dtcCodes: [] }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });

  describe('findMany (RF-05, pátio)', () => {
    it('defaults to open+in_progress when no status filter is given', async () => {
      prisma.serviceOrder.findMany.mockResolvedValue([baseOrderRow()]);

      await service.findMany();

      expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: {
              in: [ServiceOrderStatus.open, ServiceOrderStatus.in_progress],
            },
          },
        }),
      );
    });

    it('uses the given status filter when provided', async () => {
      prisma.serviceOrder.findMany.mockResolvedValue([]);

      await service.findMany([ServiceOrderStatus.completed]);

      expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: [ServiceOrderStatus.completed] } },
        }),
      );
    });

    it('paginates and maps rows to cards (RNF-10)', async () => {
      const rows = Array.from({ length: 21 }, (_, i) =>
        baseOrderRow({ id: `os-${i}` }),
      );
      prisma.serviceOrder.findMany.mockResolvedValue(rows);

      const result = await service.findMany(undefined, undefined, 20);

      expect(result.items).toHaveLength(20);
      expect(result.paging.hasMore).toBe(true);
      expect(result.items[0]).toMatchObject({
        plate: 'ABC1D23',
        customerName: 'Wilson Machado',
      });
    });
  });
});
