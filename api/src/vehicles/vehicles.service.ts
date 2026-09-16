import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { paginate, resolveLimit } from '../common/pagination';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-04: veículo criado, ou reaproveitado se a placa já existir para o
  // mesmo cliente. 409 se a placa pertencer a outro cliente.
  async create(dto: CreateVehicleDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    const existing = await this.prisma.vehicle.findUnique({
      where: { plate: dto.plate },
    });

    if (existing) {
      if (existing.customerId !== dto.customerId) {
        throw new ConflictException('Placa já pertence a outro cliente.');
      }
      return existing;
    }

    return this.prisma.vehicle.create({ data: dto });
  }

  async findMany(plate?: string, after?: string, limit?: number) {
    const take = resolveLimit(limit);

    const rows = await this.prisma.vehicle.findMany({
      where: plate ? { plate: { contains: plate.toUpperCase() } } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });

    return paginate(rows, take);
  }

  async findOneOrThrow(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }
    return vehicle;
  }
}
