import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './auth.types';
import type { CurrentUserPayload } from '../common/decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      // Fail fast: a API não deve rodar sem segredo de assinatura — isso
      // vale para toda rota protegida, diferente de GOOGLE_CLIENT_ID (que só
      // afeta o login em si, ver AuthService).
      throw new Error('Missing JWT_SECRET environment variable');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtPayload): CurrentUserPayload {
    // Vira req.user.
    return { userId: payload.sub };
  }
}
