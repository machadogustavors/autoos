import { ConflictException, NotFoundException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrisma {
  customer: { findUnique: jest.Mock };
  vehicle: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
}

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn() },
      vehicle: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new VehiclesService(prisma as unknown as PrismaService);
  });

  const dto = { customerId: 'cust-1', plate: 'ABC1D23' };

  it('rejects when the customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a new vehicle when the plate is unused', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
    prisma.vehicle.findUnique.mockResolvedValue(null);
    prisma.vehicle.create.mockResolvedValue({ id: 'v1', ...dto });

    const result = await service.create(dto);

    expect(prisma.vehicle.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: 'v1', ...dto });
  });

  it('reuses the existing vehicle when the plate already belongs to the same customer', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      customerId: 'cust-1',
      plate: 'ABC1D23',
    });

    const result = await service.create(dto);

    expect(prisma.vehicle.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'v1',
      customerId: 'cust-1',
      plate: 'ABC1D23',
    });
  });

  it('rejects with 409 when the plate belongs to a different customer', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v9',
      customerId: 'cust-2',
      plate: 'ABC1D23',
    });

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it('paginates listMany results', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `v${i}`,
      plate: `PLT${i}`,
    }));
    prisma.vehicle.findMany.mockResolvedValue(rows);

    const result = await service.findMany(undefined, undefined, 20);

    expect(result.items).toHaveLength(20);
    expect(result.paging.hasMore).toBe(true);
  });
});
