import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// e2e de verdade: sobe a aplicação inteira (guard, ValidationPipe, filtro de
// exceção) e bate HTTP com supertest — sem isso, o formato de erro do
// contrato (SPEC §5.3) só era verificado "de olho" nos unit tests.
// PrismaService é mockado — sem Postgres real neste ambiente (ver
// docs/PHASES.md).

process.env.JWT_SECRET = 'e2e-test-secret';

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

describe('AutoOS API (e2e)', () => {
  let app: INestApplication;

  // supertest tipa o servidor como `App`; getHttpServer() devolve `any`.
  const server = (): App => app.getHttpServer() as App;

  function signAccessToken(userId = 'e2e-user') {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, {
      expiresIn: '15m',
    });
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        customer: { create: jest.fn() },
        serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['dev/login'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health is public and returns ok', async () => {
    const res = await request(server()).get('/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /v1/service-orders without Authorization is 401 in the contract error shape', async () => {
    const res = await request(server()).get('/v1/service-orders');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error.code');
    expect(res.body).toHaveProperty('error.message');
    // Nunca o formato padrão do Nest ({ statusCode, message }) vazando pro cliente.
    expect(res.body).not.toHaveProperty('statusCode');
  });

  it('GET /v1/service-orders with a valid token returns an empty page', async () => {
    const res = await request(server())
      .get('/v1/service-orders')
      .set('Authorization', `Bearer ${signAccessToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [] });
  });

  it('POST /v1/customers without a name is 400 with a fields map (VALIDATION_ERROR)', async () => {
    const res = await request(server())
      .post('/v1/customers')
      .set('Authorization', `Bearer ${signAccessToken()}`)
      .send({});

    expect(res.status).toBe(400);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toHaveProperty('name');
  });

  it('GET /dev/login is outside the /v1 prefix and reachable', async () => {
    const res = await request(server()).get('/dev/login');

    expect(res.status).toBe(200);
    // Sem GOOGLE_CLIENT_ID neste ambiente de teste, a página mostra o
    // aviso de indisponibilidade — comportamento correto (Fase 2), não bug.
    expect(res.text).toContain('/dev/login indisponível');
  });
});
