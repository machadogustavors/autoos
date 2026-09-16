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
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockPrisma) => unknown) =>
      fn(prisma),
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
});
