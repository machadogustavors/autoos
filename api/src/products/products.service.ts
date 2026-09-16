import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AdjustProductDto } from './dto/adjust-product.dto';
import { paginate, resolveLimit } from '../common/pagination';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async findMany(q?: string, after?: string, limit?: number) {
    const take = resolveLimit(limit);

    const rows = await this.prisma.product.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });

    return paginate(rows, take);
  }

  async adjustQuantity(id: string, dto: AdjustProductDto) {
    await this.findOneOrThrow(id);

    return this.prisma.product.update({
      where: { id },
      data: { stockQuantity: dto.stockQuantity },
    });
  }

  async findOneOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Peça não encontrada no estoque.');
    }
    return product;
  }
}
