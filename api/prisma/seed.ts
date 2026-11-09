import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Sem auto-cadastro (RF-01): o(s) mecânico(s) da Auto Elétrica WM precisam
// existir na tabela `users` antes do primeiro login com Google. Este seed
// cria o usuário inicial pelo e-mail que vai logar — ajuste antes de rodar
// em qualquer ambiente que não seja o seu próprio local: SEED_USER_EMAIL tem
// de ser o e-mail da conta Google que vai entrar.
async function main() {
  const email = process.env.SEED_USER_EMAIL ?? 'machado.gustavo2905@gmail.com';
  const name = process.env.SEED_USER_NAME ?? 'Gustavo Machado';
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email },
  });

  console.log(`Seed concluído: ${email} pronto para login com Google.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
