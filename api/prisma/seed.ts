import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Sem auto-cadastro (RF-01): o(s) mecânico(s) da Auto Elétrica WM precisam
// existir na tabela `users` antes do primeiro login com Google. Este seed
// cria o usuário inicial pelo e-mail que vai logar — ajuste antes de rodar
// em qualquer ambiente que não seja o seu próprio local.
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.user.upsert({
    where: { email: 'wilson@autoeletricawm.com.br' },
    update: {},
    create: {
      name: 'Wilson Machado',
      email: 'wilson@autoeletricawm.com.br',
    },
  });

  console.log('Seed concluído: usuário inicial pronto para login com Google.');
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
