import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  AuthController,
  DevLoginController,
  MeController,
} from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { parseDurationMs } from './duration.util';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        // Segundos (número), não string — evita o tipo StringValue estrito
        // do @types/jsonwebtoken mais recente.
        signOptions: {
          expiresIn: Math.floor(
            parseDurationMs(
              config.get<string>('JWT_ACCESS_TOKEN_TTL') ?? '15m',
            ) / 1000,
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController, MeController, DevLoginController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
