# AutoOS

Aplicativo mobile da Auto Elétrica WM para abrir e acompanhar ordens de serviço, enriquecido por telemetria veicular capturada por um dispositivo IoT conectado à interface OBD-II/CAN do veículo.

Projeto Interdisciplinar de Extensão VI — Engenharia de Computação, SETREM. Estudo de caso único na Auto Elétrica WM (Wilson Machado).

## Por onde começar

| Arquivo | Para quê |
| --- | --- |
| [docs/SPEC.md](./docs/SPEC.md) | O que o produto faz |
| [DESIGN.md](./DESIGN.md) | Visual: cores, tipo, botões |
| [contract/openapi.yaml](./contract/openapi.yaml) | Paths, JSON, erros da API REST |
| [contract/mqtt-topics.md](./contract/mqtt-topics.md) | Tópicos e payload da telemetria (MQTT/TLS → LARCC) |
| [AGENTS.md](./AGENTS.md) | Instruções para qualquer agente (Codex, Cursor, Copilot) |
| [CLAUDE.md](./CLAUDE.md) | Ponte para o Claude Code (`@AGENTS.md`) |
| [api/](./api/) | Servidor: NestJS + TypeScript + Prisma + PostgreSQL |
| [app/](./app/) | Mobile: React Native (Expo, dev client) + TypeScript |
| [device/](./device/) | Firmware do dispositivo IoT: ESP32 + MCP2515 (leitura OBD-II/CAN) |

## Loop

autenticar → pátio (lista de OS) → abrir/criar OS → parear leitor OBD-II (BLE) → leitura automática anexada → registrar itens → acompanhar status → concluir

## Como pedir algo ao agente

O agente lê `AGENTS.md` sozinho. No chat, cite o RF e o `operationId`:

```text
Implemente RF-07 (criar OS) conforme docs/SPEC.md.
Use só postServiceOrder no contract/openapi.yaml.
Visual conforme DESIGN.md (tokens, um primário, painel de telemetria em mono).
Card = ServiceOrderCard. Sem problema completo.
Estados: esqueleto, vazio, erro, offline com rascunho.
Não crie path novo.
```

Ruim: "faz a tela de nova OS". O modelo inventa campo, fluxo e cor.

## API local

```bash
docker compose up -d
cp api/.env.example api/.env
cd api && npm install && npx prisma migrate dev && npm run start:dev
```

Sem app Android ainda: abra `http://localhost:3000/dev/login` (conta Google), copie o `idToken` e mande em `POST /v1/auth/login`. O e-mail precisa já existir em `users` (seed da migration) — login com Google não cria conta nova. Não use `idToken: "dev"`. O Android, depois, manda o mesmo JSON.

## Implantação

```bash
cp api/.env.example api/.env      # DATABASE_URL com host autoos-db; JWT_SECRET forte; GOOGLE_CLIENT_ID
mkdir -p deploy/certs             # fullchain.pem e privkey.pem (fora do git)
POSTGRES_PASSWORD=... docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma db seed   # usuário inicial (SEED_USER_EMAIL)
```

API + Postgres + Nginx; a porta 80 só redireciona para HTTPS e `/dev/login` não é exposto.

## App local

```bash
cd app && cp .env.example .env   # preencha EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID etc.
npm install
npm run android                  # dev client; BLE não funciona no Expo Go
npm test && npm run typecheck && npx eslint .
```

Precisa do Android SDK e de um aparelho (ou emulador com Google Play). Só Android na V1 (RNF-15).

## Status

- `api/`: completa (auth Google, clientes, veículos, estoque, OS, itens, snapshot de telemetria), com testes unitários e e2e.
- `app/`: telas do loop principal, pareamento BLE/ELM327 e publicação MQTT escritos, tipados e empacotando; **nunca rodaram em aparelho** (ver `docs/PHASES.md`, Fases 10 e 11).
- `device/`: firmware ESP32 (BLE) com leituras **simuladas**; compila e passa nos testes, nunca rodou numa placa nem lê CAN de verdade.

Diário de bordo e o que falta validar: [docs/PHASES.md](./docs/PHASES.md).
