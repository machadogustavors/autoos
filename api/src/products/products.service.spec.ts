import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrisma {
  product: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('creates a product', async () => {
    prisma.product.create.mockResolvedValue({
      id: 'p1',
      name: 'Filtro de óleo',
      stockQuantity: 10,
    });

    await service.create({ name: 'Filtro de óleo', stockQuantity: 10 });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: { name: 'Filtro de óleo', stockQuantity: 10 },
    });
  });

  it('rejects adjusting a product that does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.adjustQuantity('missing', { stockQuantity: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('sets the stock quantity to the given absolute value', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', stockQuantity: 3 });
    prisma.product.update.mockResolvedValue({ id: 'p1', stockQuantity: 8 });

    const result = await service.adjustQuantity('p1', { stockQuantity: 8 });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQuantity: 8 },
    });
    expect(result.stockQuantity).toBe(8);
  });

  it('searches by name when q is provided (RF-19)', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findMany('filtro');

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          name: { contains: 'filtro', mode: 'insensitive' },
        },
      }),
    );
  });

  describe('delete (RF-21)', () => {
    it('hides deleted products from the list and the search', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findMany();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('soft-deletes: stamps deletedAt instead of removing the row', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        deletedAt: null,
      });
      prisma.product.update.mockResolvedValue({});

      await service.remove('p1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { deletedAt: expect.any(Date) as Date },
      });
      // Apagar a linha quebraria o histórico das OS que usaram a peça.
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('404 when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('404 when it was already deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        deletedAt: new Date(),
      });

      await expect(service.remove('p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('cannot adjust the quantity of a deleted product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        stockQuantity: 3,
        deletedAt: new Date(),
      });

      await expect(
        service.adjustQuantity('p1', { stockQuantity: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  it('paginates results', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `p${i}`,
      name: `Peça ${i}`,
    }));
    prisma.product.findMany.mockResolvedValue(rows);

    const result = await service.findMany(undefined, undefined, 20);

    expect(result.items).toHaveLength(20);
    expect(result.paging.hasMore).toBe(true);
  });
});
