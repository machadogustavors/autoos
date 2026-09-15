# AutoOS

App da Auto Elétrica WM: abertura e acompanhamento de ordens de serviço, enriquecidas por telemetria veicular lida automaticamente da interface OBD-II/CAN do veículo.

## Stack

- Linguagem: **TypeScript** em todo o repositório (API, app, exceto firmware). Sem `any`.
- API: **NestJS** (`@nestjs/core`). Autenticação **JWT** por bearer token + refresh token — não por cookie, porque o cliente é nativo.
- Banco: **PostgreSQL** via **Prisma** ORM.
- App: **React Native** via **Expo com dev client** (BLE não funciona no Expo Go — dev client é obrigatório desde o primeiro protótipo).
- Dispositivo IoT: firmware **ESP32 + transceptor CAN MCP2515**, lendo PIDs OBD-II e DTCs. Adaptador **ELM327 comercial** como alternativa de contingência (Bluetooth Classic, perfil SPP — não BLE).
- Validação: **class-validator** na API (DTO), validação de formulário no app.
- Testes: **Jest** (unitário + e2e) na API.
- CI: **GitHub Actions** em todo push — lint (ESLint + Prettier), testes automatizados e build. PR não mergeia com o pipeline vermelho.
- Implantação: **Docker** (API + Postgres) com **Nginx** como proxy reverso.

## Onde ler o quê

Estes dois ficam na **raiz**, ao lado deste arquivo. O SPEC fica em `docs/` sozinho.

| Arquivo | Para quê |
| --- | --- |
| `AGENTS.md` | Como trabalhar neste repositório (este arquivo) |
| `DESIGN.md` | Decisões visuais: paleta, tipo, espaço, botão, raio, tokens |
| `docs/SPEC.md` | O que o produto faz (Given / When / Then, estados, RNF) |
| `contract/openapi.yaml` | HTTP: paths, JSON, erros da API |
| `contract/mqtt-topics.md` | Tópicos e payload da telemetria publicada no broker do LARCC |
| `api/` | Servidor NestJS |
| `app/` | Cliente Expo |
| `device/` | Firmware ESP32 (C++/Arduino ou ESP-IDF) |

Não invente cor, tipo ou botão. Isso está em `DESIGN.md`. Hex e espaço no código: `app/theme/tokens.ts`.

Não invente path de API. Isso está em `contract/openapi.yaml`.

Não invente tópico ou campo de telemetria. Isso está em `contract/mqtt-topics.md`.

## Três protocolos, três pernas — não confunda

```
Dispositivo (ESP32+MCP2515, ou ELM327 na contingência)
      │ BLE (ELM327: Bluetooth Classic / SPP)
      ▼
App mobile (React Native)
      │ HTTPS ──────────────▶ API AutoOS (dados transacionais: OS, cliente, veículo)
      └ MQTT sobre TLS ─────▶ Broker do LARCC (telemetria de alta frequência)
```

- **Device → App**: BLE (GATT). Contingência ELM327: Bluetooth Classic/SPP — por isso a validação da V1 é só Android (iOS restringe Bluetooth Classic a acessórios certificados MFi).
- **App → API AutoOS**: HTTPS, JSON, `Authorization: Bearer`. Só para o que é transacional (OS, item, cliente, veículo, e o *snapshot* de telemetria anexado à OS).
- **App → LARCC**: MQTT sobre TLS. Só para o fluxo contínuo/bruto de telemetria (RPM, temperatura, tensão, DTCs ao longo do tempo), mantido fora do Postgres transacional. Identificadores do veículo são pseudonimizados **antes** de sair do app (LGPD).

Nunca escreva telemetria de alta frequência direto no Postgres via API. Nunca mande dado transacional (OS, cliente) pelo MQTT.

## Comandos

```bash
docker compose up -d
cd api && npm install && npx prisma migrate dev && npm run start:dev
cd api && npm run test          # Jest unitário
cd api && npm run test:e2e      # Jest e2e
cd api && npm run lint          # ESLint
cd api && npm run format        # Prettier
cd api && npx prisma generate   # depois de mudar api/prisma/schema.prisma
cd api && npx prisma studio     # inspecionar dados locais
```

Health: `GET http://localhost:3000/v1/health` (200 só se o Postgres responder).

Env: `api/.env` (gitignored). Modelo: `api/.env.example`. Sem segredo de LARCC (broker, certificado TLS) no git.

## API

Postgres local (Docker na raiz). Sem multi-tenant: a V1 atende só a Auto Elétrica WM — não existe tabela de empresa/`workshopId`. Se o projeto crescer para outras oficinas, isso é trabalho futuro documentado, não algo a antecipar agora.

Banco: **Prisma**. Schema em `api/prisma/schema.prisma`. Migration: `npx prisma migrate dev --name <nome>`. Não edite SQL de migration já aplicada: mude o schema e gere a próxima.

Rotas públicas: `GET /v1/health`, `POST /v1/auth/login`, `POST /v1/auth/refresh`. O resto exige `Authorization: Bearer`.

`POST /v1/auth/login`: body `{ email, password }`. Devolve `{ accessToken, refreshToken, user }`. `POST /v1/auth/refresh`: body `{ refreshToken }`, devolve novo par de tokens (rotação). Sem cookie — o app guarda os tokens em armazenamento seguro do sistema (Keychain/Keystore via `expo-secure-store`).

Não crie `/login` fora de `/v1/auth/login`. Não reutilize cookie de sessão do frontend web do GMOpero — este é um sistema novo, sem código compartilhado com o GMOpero.

## Testes

**Jest**: `api/src/**/*.spec.ts` (unitário) e `api/test/*.e2e-spec.ts` (e2e) travam o contrato (Given / When / Then do SPEC). CI roda os dois em todo push, junto com ESLint e Prettier.

- Rota nova: escreva o teste primeiro. Ele tem de falhar. Depois o código.
- Não altere teste para ficar verde. Altere o código.
- Se o SPEC mudar, o teste muda no mesmo PR.
- `npm run lint` e `npm run format` antes de abrir PR — o CI recusa código que o autofix mudaria.

## Como escrever código

- Tipar parâmetros, retorno e JSON. Campo novo: primeiro o OpenAPI (ou `mqtt-topics.md`, se for telemetria), depois o código.
- Na API, validar com `class-validator` no DTO antes de persistir.
- No app: UI → estado → repositório. A tela não chama a rede nem o BLE direto.
- Qualquer tela: leia `DESIGN.md` antes de gerar UI.
- Qualquer leitura de dispositivo: leia a seção de IoT em `docs/SPEC.md` e `contract/mqtt-topics.md` antes de gerar código de pareamento ou parsing de PID.
- Sem chat, push nativo ou upload de arquivo — fora do escopo da V1.
- Sem fornecedor, compra ou pagamento na OS — a V1 é operacional: cliente, veículo, OS, itens (peça/serviço, sem preço), **estoque simples de peças** e telemetria. Estoque entra porque toda peça usada precisa dar baixa em algo, senão o mecânico não sabe o que tem disponível; fornecedor, compra e pagamento ficam para uma fase futura, se o produto crescer para o lado financeiro.

## Se os docs discordarem

1. `contract/openapi.yaml` (HTTP transacional)
2. `contract/mqtt-topics.md` (telemetria)
3. `docs/SPEC.md` (comportamento)
4. `DESIGN.md` (visual)
5. este arquivo (pastas, stack, comandos)
