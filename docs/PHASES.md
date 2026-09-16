# AutoOS · Fases de implementação

Plano de execução do projeto, em fases pequenas e comitáveis. Cada fase termina com um commit próprio. Este arquivo é atualizado a cada fase concluída, marcando o que foi implementado e o que ficou pendente — o status reflete o estado real no momento do commit daquela fase, não um plano.

Não é o SPEC (isso é [`SPEC.md`](./SPEC.md)) nem o contrato (isso é [`../contract/`](../contract/)) — é o **diário de bordo** da implementação.

**Fora do escopo por decisão explícita nesta rodada:** credenciais reais (Google OAuth Client ID, broker LARCC). O código é escrito para usá-las via variável de ambiente, mas os valores ficam vazios em `.env.example` — isso significa que login com Google e publicação MQTT real não rodam ponta a ponta ainda. Isso é esperado e não é um bug desta fase.

---

## Fase 1 — Scaffold do backend

**Status:** ✅ concluída

Estrutura inicial do `api/` (NestJS 11 + TypeScript + Prisma 7, mesmo padrão de tooling do GMOpero: ESLint flat config, Prettier, Jest), `schema.prisma` completo a partir da seção 6.2 do SPEC (`users`, `refresh_tokens`, `customers`, `vehicles`, `service_orders`, `products`, `service_order_items`, `telemetry_snapshots`, `idempotency_keys`), `docker-compose.yml` (Postgres local, porta 5432 + banco de teste na 5433), `.env.example` com `GOOGLE_CLIENT_ID`/LARCC vazios de propósito, `prisma/seed.ts` (cria o usuário inicial por e-mail, já que não há auto-cadastro), decorator `Public` compartilhado, módulo de saúde (`GET /v1/health`, 503 se o Postgres não responder).

Validado nesta fase: `npm install`, `prisma generate`, `nest build`, `eslint` e `jest` (2 testes do health controller) rodam limpos. **Não validado:** migration real contra Postgres — Docker Desktop não estava ativo neste ambiente; rodar `docker compose up -d && npx prisma migrate dev` é o primeiro passo de quem continuar.

## Fase 2 — Autenticação (Google Sign-In + refresh token)

**Status:** ✅ concluída

`AuthModule`: `postLogin` (verifica `idToken` do Google via `google-auth-library`, casa e-mail com usuário já existente, sem auto-cadastro — 403 se não achar), vincula `googleSub` no primeiro login bem-sucedido, `postRefreshToken` (rotação: token usado é marcado `revokedAt`; reapresentar um token revogado derruba **todos** os tokens daquele usuário), `getMe`, `JwtAuthGuard` global (respeita `@Public()`), página `GET /dev/login` (fora do prefixo `/v1`, replicando o padrão do conecta-campus).

Decisão de implementação: `GOOGLE_CLIENT_ID` só é checado dentro do `AuthService` (na hora do login), não no bootstrap da API — assim a API sobe e o resto dos módulos continua desenvolvível mesmo sem a credencial (`JWT_SECRET`, esse sim, ainda falha rápido no `JwtStrategy`, por proteger toda rota, não só o login).

Validado: `nest build`, `eslint` e `jest` (9 testes: health + `AuthService.login`/`.refresh`, incluindo o caso de reuso de refresh token) rodam limpos. **Não validado:** `POST /v1/auth/login` ponta a ponta contra o Google real — sem `GOOGLE_CLIENT_ID`, isso é esperado (ver `.env.example`).

## Fase 3 — Clientes e veículos

**Status:** ✅ concluída

`CustomersModule` (RF-03) e `VehiclesModule` (RF-04): cadastro rápido, busca por nome/telefone (`listCustomers`) ou placa (`listVehicles`), placa validada por regex (padrão antigo ou Mercosul), veículo **reaproveitado** se a placa já existir para o mesmo cliente, 409 se pertencer a outro. Paginação por cursor (`common/pagination.ts`) extraída como utilitário compartilhado — todo `list*` futuro (produtos, OS) reaproveita.

`GET /vehicles/{id}/service-orders` (RF-18) fica pra Fase 5, quando `ServiceOrdersModule` existir.

Validado: `nest build`, `eslint` e `jest` (18 testes) rodam limpos.

## Fase 4 — Estoque

**Status:** ✅ concluída

`ProductsModule` (RF-19/RF-20): `listProducts` (busca por nome), `postProduct` (cadastro), `patchProduct` (ajuste **absoluto** de `stockQuantity`, não delta — reposição manual ou correção de uma baixa indevida da RF-11a). `ProductsService.findOneOrThrow` exportado para a Fase 5 usar na baixa transacional de item de OS.

Validado: `nest build`, `eslint` e `jest` (21 testes) rodam limpos.

## Fase 5 — Ordens de serviço e itens

**Status:** ✅ concluída

`ServiceOrdersModule` (RF-05 a RF-11a, RF-18): pátio paginado com filtro de status (padrão: `open`+`in_progress`), `postServiceOrder` idempotente com regra de uma OS ativa por veículo (409), máquina de estados RF-10 (transições fora da lista viram 409, inclusive pular `in_progress`), itens com baixa de estoque **atômica e à prova de corrida** (`UPDATE ... WHERE stock_quantity >= quantity`, não um read-then-write ingênuo — RNF-16), `listVehicleServiceOrders` (RF-18) num controller próprio pra não criar dependência circular entre `ServiceOrdersModule` e `VehiclesModule`.

Infra nova nesta fase, motivada diretamente pelo `INSUFFICIENT_STOCK` da RF-11a: `IdempotencyService` compartilhado (`common/idempotency.service.ts`, usado por `postServiceOrder` e `postServiceOrderItem`) e um `HttpExceptionFilter` global que reformata toda exceção pro formato do contrato (`{ error: { code, message, fields? } }`, SPEC §5.3) — inclusive extraindo `fields` das mensagens do `class-validator`.

Validado: `nest build`, `eslint` e `jest` (34 testes — 13 novos cobrindo criação, transição de estado e a baixa de estoque, incluindo o caminho de estoque insuficiente) rodam limpos.

## Fase 6 — Telemetria (snapshot transacional)

**Status:** ✅ concluída

`postServiceOrderTelemetry` (RF-13): snapshot anexado à OS e atualização de `vehicles.reference_mileage` na **mesma transação** (`$transaction` em array — a leitura vira a referência do veículo, substituindo o valor cadastrado manualmente em RF-04). `dtcCodes` sempre `[]`, nunca omitido, mesmo sem código ativo.

A leitura (`lastTelemetry` em `ServiceOrderDetail`, `hasDtcOnLastReading` em `ServiceOrderCard`) já tinha sido implementada na Fase 5 via `include: { telemetrySnapshots: {...} }` — esta fase só precisou acrescentar o lado da escrita; nada foi retrabalhado no mapeamento.

**Lembrete de escopo:** isto é só o snapshot pontual. O fluxo contínuo/bruto (RF-14, MQTT → LARCC) não passa pela API — é publicado direto pelo app, e vive fora deste backend (ver `contract/mqtt-topics.md`).

Validado: `nest build`, `eslint` e `jest` (37 testes — 3 novos) rodam limpos.

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
