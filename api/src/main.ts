import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // Cliente é nativo (RF-01/RF-02): sem cookie, sem CORS de navegador a
  // proteger — mas /dev/login (AGENTS.md) roda no navegador em dev.
  app.enableCors();

  // /dev/login fica fora do /v1 de propósito: não é rota de produto (AGENTS.md).
  app.setGlobalPrefix('v1', { exclude: ['dev/login'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Todo 4xx/5xx sai no formato do contrato (SPEC §5.3): { error: { code, message, fields? } }.
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
