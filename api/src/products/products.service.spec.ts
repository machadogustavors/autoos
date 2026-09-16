import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrisma {
  product: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
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
});
