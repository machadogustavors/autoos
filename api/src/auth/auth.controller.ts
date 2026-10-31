import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public, CurrentUser } from '../common/decorators';
import type { CurrentUserPayload } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.idToken);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }
}

// getMe vive em /v1/me no contrato (openapi.yaml), não em /v1/auth/me.
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user.userId);
  }
}

// GET /dev/login — ajuda de desenvolvimento (AGENTS.md), fora do prefixo
// /v1 de propósito: não é rota de produto, é uma página HTML local pra
// escolher a conta Google e copiar o idToken real, sem precisar do app
// Android rodando ainda. Nunca aceita "idToken: dev" nem qualquer bypass —
// login continua exigindo um idToken de verdade emitido pelo Google.
@Controller('dev')
export class DevLoginController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('login')
  @Header('Content-Type', 'text/html')
  page(): string {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    if (!clientId) {
      return `<!doctype html>
<html><body style="font-family: sans-serif; padding: 2rem;">
<h1>/dev/login indisponível</h1>
<p>GOOGLE_CLIENT_ID não está configurado em <code>api/.env</code> neste ambiente.
Isso é esperado até alguém criar o projeto no Google Cloud Console
(ver <code>docs/PHASES.md</code>).</p>
</body></html>`;
    }

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AutoOS — dev login</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h1>AutoOS — login de desenvolvimento</h1>
  <p>Escolha a conta Google já cadastrada como usuário do AutoOS. O idToken
  aparece abaixo pra copiar e usar em <code>POST /v1/auth/login</code>.</p>
  <div id="g_id_onload"
       data-client_id="${clientId}"
       data-callback="handleCredentialResponse">
  </div>
  <div class="g_id_signin" data-type="standard"></div>
  <pre id="token" style="white-space: pre-wrap; word-break: break-all; background: #f2f2f2; padding: 1rem; margin-top: 1rem;"></pre>
  <script>
    function handleCredentialResponse(response) {
      document.getElementById('token').textContent = response.credential;
    }
  </script>
</body>
</html>`;
  }
}
