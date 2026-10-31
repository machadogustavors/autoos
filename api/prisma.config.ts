import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: a URL do banco e o seed saem do schema e vêm daqui.
// `prisma generate` não precisa do banco (build de imagem e clone novo rodam
// sem .env); migrate/studio/seed precisam de DATABASE_URL (api/.env, modelo em
// api/.env.example) e falham com URL inválida se ela faltar.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
