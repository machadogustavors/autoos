import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // getHealth (contract/openapi.yaml) — 200 só se o Postgres responder,
  // mesmo critério documentado no AGENTS.md do conecta-campus que inspirou
  // este padrão.
  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const };
    } catch {
      throw new ServiceUnavailableException({ status: 'error' });
    }
  }
}
