# AutoOS · Fases de implementação

Plano de execução do projeto, em fases pequenas e comitáveis. Cada fase termina com um commit próprio. Este arquivo é atualizado a cada fase concluída, marcando o que foi implementado e o que ficou pendente — o status reflete o estado real no momento do commit daquela fase, não um plano.

Não é o SPEC (isso é [`SPEC.md`](./SPEC.md)) nem o contrato (isso é [`../contract/`](../contract/)) — é o **diário de bordo** da implementação.

**Fora do escopo por decisão explícita nesta rodada:** credenciais reais (Google OAuth Client ID, broker LARCC). O código é escrito para usá-las via variável de ambiente, mas os valores ficam vazios em `.env.example` — isso significa que login com Google e publicação MQTT real não rodam ponta a ponta ainda. Isso é esperado e não é um bug desta fase.

---

## Fase 1 — Scaffold do backend

**Status:** ⏳ planejada

Estrutura inicial do `api/` (NestJS + TypeScript), `schema.prisma` completo a partir da seção 6.2 do SPEC, `docker-compose.yml` (Postgres local, mesmo padrão do GMOpero), `.env.example`, módulo de saúde (`GET /v1/health`).

## Fase 2 — Autenticação (Google Sign-In + refresh token)

**Status:** ⏳ planejada

`AuthModule`: `postLogin` (verifica `idToken` do Google via `google-auth-library`, casa e-mail com usuário já existente, sem auto-cadastro), `postRefreshToken` (rotação com detecção de reuso), `getMe`, guard global de JWT, página `GET /dev/login`.

## Fase 3 — Clientes e veículos

**Status:** ⏳ planejada

`CustomersModule` (RF-03) e `VehiclesModule` (RF-04): cadastro rápido, busca por nome/placa, unicidade de placa com 409.

## Fase 4 — Estoque

**Status:** ⏳ planejada

`ProductsModule` (RF-19/RF-20): consulta e cadastro/ajuste de quantidade.

## Fase 5 — Ordens de serviço e itens

**Status:** ⏳ planejada

`ServiceOrdersModule` (RF-05 a RF-11a): pátio paginado, criação com `Idempotency-Key` e regra de uma OS ativa por veículo, máquina de estados, itens com baixa automática de estoque transacional.

## Fase 6 — Telemetria (snapshot transacional)

**Status:** ⏳ planejada

`postServiceOrderTelemetry` (RF-13): snapshot anexado à OS, atualização da quilometragem de referência do veículo, exposição em `ServiceOrderDetail.lastTelemetry` e `ServiceOrderCard.hasDtcOnLastReading`.

## Fase 7 — Testes automatizados

**Status:** ⏳ planejada

Specs Jest (unitário + e2e) cobrindo a tabela da seção 6.5 do SPEC: idempotência, transição de status inválida, estoque insuficiente, paginação do pátio.

## Fase 8 — CI

**Status:** ⏳ planejada

`.github/workflows/ci.yml`: lint (ESLint + Prettier), testes, build — em todo push, conforme comprometido no AGENTS.md.

## Fase 9 — Scaffold do app mobile

**Status:** ⏳ planejada

Estrutura inicial do `app/` (Expo + TypeScript, dev client), `app/theme/tokens.ts` gerado a partir do YAML do DESIGN.md, cliente HTTP tipado a partir do OpenAPI, armazenamento seguro de token.

## Fase 10 — Telas do loop principal

**Status:** ⏳ planejada

Login (Google Sign-In), Pátio, Nova OS, Detalhe da OS (com painel de telemetria e itens), Estoque — componentes conforme `DESIGN.md` (`card-service-order`, `panel-telemetry`, `chip-status-*`, etc.).

## Fase 11 — Pareamento BLE e telemetria no app

**Status:** ⏳ planejada

Camada `ObdReader`/`BleReader`/`Elm327ClassicReader` (RF-12/RF-16/RF-17), tela de pareamento, publisher MQTT (RF-14/RF-15, com pseudonimização do veículo) — gera UUIDs reais nesta fase (fecha o Known Gap do `contract/mqtt-topics.md`).

## Fase 12 — Firmware do dispositivo IoT

**Status:** ⏳ planejada

Projeto PlatformIO em `device/`: firmware ESP32 expondo o serviço BLE de telemetria descrito em `contract/mqtt-topics.md`, com leitura simulada de PIDs OBD-II (sem MCP2515 físico conectado ainda).

---

## O que não vai ficar pronto para produção nesta rodada (por design, não por atraso)

- **Credenciais reais** (Google OAuth, broker LARCC) — fora do escopo desta rodada, conforme combinado.
- **Hardware físico**: o firmware vai rodar em simulação de leitura; validação com MCP2515 + veículo real é a próxima etapa fora do código.
- **iOS**: fora do escopo da V1 (ver RNF-15).
- **`npm install` / `npx prisma migrate dev`**: os projetos são escritos com todas as dependências declaradas; a instalação real roda durante as fases quando possível, mas o ambiente final de quem for continuar precisa confirmar.
