# API AutoOS — imagem de produção. Contexto de build: api/
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
# Gera o client sem precisar do banco (prisma.config.ts tolera DATABASE_URL vazia).
RUN npx prisma generate
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# node_modules completo de propósito: `prisma migrate deploy` roda na subida
# e o CLI do Prisma é devDependency.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
USER node
EXPOSE 3000
# Aplica as migrations pendentes e sobe a API. Falha de migration derruba o
# container (melhor que subir com schema velho).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
