import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('google-auth-library');

interface MockPrisma {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwtService: { signAsync: jest.Mock };
  let configValues: Record<string, string>;
  let verifyIdToken: jest.Mock;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.access.token'),
    };
    configValues = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      JWT_REFRESH_TOKEN_TTL: '30d',
    };

    verifyIdToken = jest.fn();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      verifyIdToken,
    }));

    const configService = {
      get: (key: string) => configValues[key],
    } as ConfigService;

    service = new AuthService(
      prisma as PrismaService,
      jwtService as unknown as JwtService,
      configService,
    );
  });

  describe('login', () => {
    it('rejects an idToken that fails Google verification', async () => {
      verifyIdToken.mockRejectedValue(new Error('bad token'));

      await expect(service.login('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a valid Google account whose e-mail is not a registered user (no self sign-up)', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'stranger@gmail.com',
          sub: 'google-sub-1',
        }),
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('good-token')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('links googleSub to an existing user on first successful login and issues tokens', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'wilson@autoeletricawm.com.br',
          sub: 'google-sub-1',
          name: 'Wilson',
        }),
      });
      // Primeira chamada: busca por googleSub, ainda não vinculado.
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // Segunda chamada: busca por e-mail, usuário já existe (seed).
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        name: 'Wilson Machado',
        email: 'wilson@autoeletricawm.com.br',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Wilson Machado',
        email: 'wilson@autoeletricawm.com.br',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('good-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleSub: 'google-sub-1' },
      });
      expect(result.user).toEqual({
        id: 'user-1',
        name: 'Wilson Machado',
        email: 'wilson@autoeletricawm.com.br',
      });
      expect(result.accessToken).toBe('signed.access.token');
      expect(typeof result.refreshToken).toBe('string');
    });
  });

  describe('refresh', () => {
    it('rejects an unknown refreshToken', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired refreshToken', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes every token of the user when a used (revoked) refreshToken is replayed', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      });

      await expect(service.refresh('reused')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() é `any` no @types/jest
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rotates a valid refreshToken: revokes the old one and issues a new pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('valid-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() é `any` no @types/jest
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe('signed.access.token');
      expect(typeof result.refreshToken).toBe('string');
    });
  });
});
