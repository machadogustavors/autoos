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

## Status

Fase de design de documentação — `api/`, `app/` e `device/` ainda não têm código. Este README e os arquivos ao lado descrevem o alvo antes da primeira linha.
