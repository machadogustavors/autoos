import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// RF-08, RF-11, RNF-06 — POST de OS e de item exigem `Idempotency-Key`.
// Duas requisições com a mesma chave devolvem o mesmo recurso, sem criar
// duplicata (retry do app depois de timeout/5xx/offline).
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T extends { id: string }>(
    key: string,
    userId: string,
    operation: string,
    fetchExisting: (resourceId: string) => Promise<T | null>,
    createFn: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing?.resourceId) {
      const resource = await fetchExisting(existing.resourceId);
      if (resource) {
        return resource;
      }
    }

    const created = await createFn();

    try {
      await this.prisma.idempotencyKey.create({
        data: { key, userId, operation, resourceId: created.id },
      });
    } catch {
      // Corrida: outra requisição com a mesma key já registrou primeiro.
      // Sem problema — o recurso já existe e é o que importa devolver.
    }

    return created;
  }
}
