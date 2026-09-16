import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrisma {
  customer: { create: jest.Mock; findMany: jest.Mock };
}

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      customer: { create: jest.fn(), findMany: jest.fn() },
    };
    service = new CustomersService(prisma as unknown as PrismaService);
  });

  it('creates a customer with the given DTO', async () => {
    prisma.customer.create.mockResolvedValue({
      id: 'c1',
      name: 'Maria',
      phone: null,
    });

    await service.create({ name: 'Maria' });

    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { name: 'Maria' },
    });
  });

  it('paginates results and reports hasMore when there is an extra row', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `c${i}`,
      name: `Cliente ${i}`,
    }));
    prisma.customer.findMany.mockResolvedValue(rows);

    const result = await service.findMany(undefined, undefined, 20);

    expect(result.items).toHaveLength(20);
    expect(result.paging.hasMore).toBe(true);
    expect(result.paging.nextCursor).toBe('c19');
  });

  it('reports hasMore=false when there is no extra row', async () => {
    const rows = [{ id: 'c1', name: 'Único' }];
    prisma.customer.findMany.mockResolvedValue(rows);

    const result = await service.findMany();

    expect(result.items).toHaveLength(1);
    expect(result.paging.hasMore).toBe(false);
    expect(result.paging.nextCursor).toBeNull();
  });

  it('searches by name and phone when q is provided', async () => {
    prisma.customer.findMany.mockResolvedValue([]);

    await service.findMany('wilson');

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'wilson', mode: 'insensitive' } },
            { phone: { contains: 'wilson' } },
          ],
        },
      }),
    );
  });
});
