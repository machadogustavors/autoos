import { randomBytes, createHash } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleIdentity, TokenPair } from './auth.types';
import { parseDurationMs } from './duration.util';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // RF-01. GOOGLE_CLIENT_ID só é exigido aqui (não no bootstrap da API,
  // como o JWT_SECRET) — sem ele, só o login fica indisponível; o resto da
  // API continua desenvolvível. Ver docs/PHASES.md, "fora do escopo desta
  // rodada".
  private getGoogleClient(): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    if (!clientId) {
      throw new UnauthorizedException(
        'Login com Google indisponível: GOOGLE_CLIENT_ID não configurado neste ambiente.',
      );
    }

    this.googleClient ??= new OAuth2Client(clientId);
    return this.googleClient;
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
    const client = this.getGoogleClient();
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    let payload: TokenPayload | undefined;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('idToken inválido ou expirado.');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('idToken inválido ou expirado.');
    }

    return { email: payload.email, googleSub: payload.sub, name: payload.name };
  }

  // RF-01: login não cria usuário novo. E-mail precisa já existir (seed).
  async login(idToken: string) {
    const identity = await this.verifyGoogleIdToken(idToken);

    let user = await this.prisma.user.findUnique({
      where: { googleSub: identity.googleSub },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: identity.email },
      });

      if (!user) {
        throw new ForbiddenException(
          'E-mail não cadastrado como usuário do AutoOS.',
        );
      }

      // Primeira vez que este e-mail loga com sucesso: vincula a conta Google.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleSub: identity.googleSub },
      });
    }

    const tokens = await this.issueTokenPair(user.id);

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  // RF-02: rotação com detecção de reuso.
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException('refreshToken inválido.');
    }

    if (stored.revokedAt) {
      // Reuso de token já rotacionado = possível roubo. Mata a sessão inteira.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'refreshToken já utilizado — sessão revogada.',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('refreshToken expirado.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(stored.userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return { id: user.id, name: user.name, email: user.email };
  }

  private async issueTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync({ sub: userId });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const ttl =
      this.configService.get<string>('JWT_REFRESH_TOKEN_TTL') ?? '30d';

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + parseDurationMs(ttl)),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
