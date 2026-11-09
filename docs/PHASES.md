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

**Status:** ✅ concluída

Unitários cobrindo idempotência (`IdempotencyService`), transição de status inválida, estoque insuficiente e paginação do pátio, mais um e2e (`api/test/app.e2e-spec.ts`) que sobe a aplicação inteira (guard JWT, `ValidationPipe`, `HttpExceptionFilter`) e bate HTTP com supertest: `/v1/health` público, 401 sem token no formato do contrato, token válido passa pelo guard, 400 com `fields` por campo, `/dev/login` fora do prefixo `/v1`. `PrismaService` é mockado nos e2e (sem Postgres real neste ambiente).

Bug real achado pelo e2e: o `HttpExceptionFilter` tratava como "já no formato do contrato" qualquer corpo com chave `error` — mas o `ValidationPipe` do Nest também tem `error` (string `"Bad Request"`), então o 400 de validação vazava sem `fields`. Corrigido em `isErrorBody`.

Validado: `nest build`, `eslint`, `prettier`, `jest` (46 testes) e `jest:e2e` (5 testes) rodam limpos.

## Fase 8 — CI

**Status:** ✅ concluída

`.github/workflows/ci.yml`: em todo push e PR roda `prisma generate`, ESLint (sem `--fix`), `prettier --check`, build, Jest unitário e e2e. Os comandos são os mesmos que passam localmente. **Não validado:** a execução no GitHub Actions em si (nenhum push feito ainda); marcar o job `api` como check obrigatório na `main` é configuração do repositório no GitHub, fora do código.

## Fase 9 — Scaffold do app mobile

**Status:** ✅ concluída

`app/` (Expo SDK 58 + React Native 0.88 + TypeScript, dev client, só Android): `theme/tokens.ts` copiado do front matter do DESIGN.md; tipos em `api/types.ts` espelhando o OpenAPI; `ApiClient` (bearer, `Idempotency-Key`, timeout, erro no formato do contrato) com renovação de sessão da RF-02 — um 401 dispara **um** refresh compartilhado entre chamadas simultâneas (a rotação trataria o segundo uso como token roubado) e repete a chamada uma vez; refresh recusado encerra a sessão, refresh com rede/5xx caída **não** desloga; tokens só em `expo-secure-store`. Repositórios (`repositories/`) com cache de leitura para o modo offline e rascunho da Nova OS; kit de UI conforme DESIGN.md (`Button`, `Card`, `Chip`, `BleBadge`, `Banner`, `TelemetryPanel`, `TextField`, `Screen`, estados vazio/esqueleto, controle segmentado).

Lacuna de contrato achada aqui: `ServiceOrderCard` não trazia `vehicleId`, necessário para abrir o histórico (RF-18) e derivar o `vehicleHash` (RF-15). Entrou primeiro no OpenAPI, com teste na API (commit separado).

Validado: `tsc`, ESLint (`no-explicit-any` como erro), Prettier, Jest (cliente HTTP incluindo refresh e concorrência, cache offline, rascunho, validação de formulário) e `expo export --platform android` (Metro resolve `mqtt` e `@noble/hashes`). `expo prebuild` gera o projeto Android com as permissões de Bluetooth corretas.

## Fase 10 — Telas do loop principal

**Status:** ✅ concluída (compila e empacota; **nunca rodou em aparelho**)

Login, Pátio, Nova OS (cliente e veículo cadastrados na hora, rascunho salvo a cada edição e chave de idempotência que só muda quando o conteúdo muda), Detalhe da OS (painel de telemetria, itens, próximo passo da máquina de estados como único primário), Adicionar item (peça do estoque com baixa, peça avulsa, serviço), Estoque (busca, cadastro, ajuste absoluto), Histórico do veículo. Estados de loading, vazio, erro por seção e offline com cache em todas as listas.

Decisões: o seletor Serviço/Peça é um controle segmentado, não dois botões, para manter um primário por view; quantidade de estoque não usa fonte mono (mono é só de sensor, DESIGN.md).

Validado: 28 testes de renderização (`__tests__/screens.test.tsx`, React Native Testing Library, serviços trocados por fakes) cobrem pátio (esqueleto, card, DTC, vazio, erro com retry, cache offline), detalhe (próximo passo por status, painel de telemetria, 409 explicado, itens), Nova OS (rascunho restaurado, falha de rede mantém o rascunho e o retry reenvia a **mesma** `Idempotency-Key`, editar gera chave nova, 409), Adicionar item (validação, `INSUFFICIENT_STOCK`), Pareamento (permissão negada, falha de conexão, leitura ao vivo, anexar, leitura sem quilometragem nunca é enviada, reconectando) e Login. Isso pegou que `TextField` não expunha o rótulo para acessibilidade.

**Não validado:** nenhuma tela foi aberta em emulador ou aparelho — não há Android SDK nesta máquina. O teste de renderização prova estrutura e comportamento, **não** layout real, teclado, rolagem, gesto, tema nem a navegação entre telas (o `Navigation.tsx` não é exercitado).

## Fase 11 — Pareamento BLE e telemetria no app

**Status:** ✅ código concluído; **sem nenhuma validação com hardware**

`obd/`: interface `ObdReader` com `BleReader` (ESP32, GATT notify, junta payload fragmentado por MTU, reconecta ao mesmo dispositivo por ~30 s antes de voltar ao scan) e `Elm327ClassicReader` (SPP, init AT, polling de PIDs, mesma reconexão). Parsing de payload com faixas físicas (leitura fora de faixa é descartada inteira) e de respostas ELM327 (`010C`, `0105`, `0142`, `01A6`, modo `03`). `telemetry/`: `vehicleHash` (HMAC-SHA256 do id interno do veículo), payload MQTT sem placa, `LarccPublisher` que só liga com `wss://` e engole qualquer falha (RNF-04), snapshot HTTP só ao confirmar na tela. UUIDs GATT reais gerados (fecha o Known Gap do `mqtt-topics.md`).

Decisões que mudam o contrato de leitura: o ELM327 usa o PID `01A6` (odômetro) para `mileage`, **não** `0131` — o snapshot grava `vehicles.reference_mileage`, e `0131` (distância desde que os códigos foram apagados) corromperia o dado. Sem `01A6` não há snapshot (nada é inventado). MQTT vai por `wss://` porque React Native não abre TCP+TLS cru; o broker do LARCC precisa de listener WebSocket seguro.

Validado (Jest): parsing de payload e de PIDs com vetores calculados à mão, montagem de frames, HMAC contra o vetor RFC 4231, payload MQTT sem placa nem id cru, publisher desligado sem TLS e sem quebrar o fluxo quando o broker falha.

**Não validado e com risco real:**
- BLE e Bluetooth Classic nunca falaram com hardware: nem o ESP32 (firmware é a Fase 12) nem um ELM327. RNF-14 (queda de sinal a 5 m) e a taxa de reconexão da validação da V1 estão por medir.
- `react-native-bluetooth-classic` aparece como **não testada na New Architecture** (`expo-doctor`) e o RN 0.88 só tem New Architecture. O fallback ELM327 pode não carregar em runtime; só um build no aparelho diz. Se falhar, a alternativa é trocar a lib ou escrever um módulo nativo mínimo.
- O parser de DTC do modo `03` trata o byte de contagem de ECUs CAN por heurística (resto ímpar → descarta o 1º byte). Precisa ser conferido contra um veículo real.
- `mqtt` nunca conectou num broker de verdade; só o empacotamento e o publisher (com cliente falso) foram exercitados.
- A chave do `vehicleHash` vai no bundle (`EXPO_PUBLIC_*`): protege a placa do LARCC, não de quem extrai o APK.

## Fase 12 — Firmware do dispositivo IoT

**Status:** ✅ concluída (compila e passa nos testes; **nunca rodou numa placa**)

`device/` (PlatformIO, Arduino + NimBLE-Arduino 2.x): anuncia `AutoOS-<sufixo do MAC>` com o service UUID do contrato e notifica 1 leitura por segundo pela característica de telemetria. Interface `ObdSource` com uma única implementação, a **simulada** (motor esquenta, bateria ~12,6 V, `P0301` liga e desliga a cada minuto, quilometragem fictícia) — o MCP2515 não está ligado. Serialização do payload em C++ puro (`reading.cpp`): campo sem resposta é omitido (nunca `0`), `dtcCodes` sempre presente, faixas iguais às do app, buffer pequeno demais é recusado em vez de estourar.

Decisão de contrato: o ESP32 não tem relógio, então `capturedAt` passou a ser **opcional no payload BLE** e o app carimba a chegada (`parseReadingPayload` recebe `receivedAt`). No MQTT e no snapshot HTTP continua obrigatório.

Validado: `pio test -e native` (11 testes Unity: payload exato do contrato, omissão de PID, faixas, DTC malformado, buffer pequeno, pior caso de 8 DTCs, simulador) e `pio run -e esp32dev` (compila; flash 60%, RAM 11%), ambos num container. O CI repete os dois.

**Não validado:**
- Nada foi gravado numa ESP32. Anúncio (UUID no anúncio, nome na resposta de scan), negociação de MTU, notificações em pedaços e religar o anúncio após desconexão estão escritos conforme a API do NimBLE, mas ninguém conectou o app a uma placa. É o primeiro teste a fazer com hardware na mão.
- Não há implementação real de CAN/MCP2515: ler `010C`/`0105`/`0142`/`01A6`/`03` num veículo é a próxima etapa e exige a placa e um carro.

## Fase 13 — Implantação e validação contra Postgres real

**Status:** ✅ concluída

Até aqui a API só tinha rodado com Prisma mockado. Com o Docker de pé, a migration foi gerada, aplicada e conferida contra um Postgres 16 real, e um smoke test de 34 verificações percorreu o fluxo inteiro da V1 pela API em execução: criação de cliente/veículo/OS, `Idempotency-Key`, uma OS ativa por veículo, baixa de estoque (inclusive **6 requisições paralelas disputando 3 unidades: 3 passam, 3 recebem 409, estoque termina em 0**), snapshot de telemetria atualizando `reference_mileage`, máquina de estados e histórico do veículo.

Bugs reais que só apareceram assim (todos já corrigidos):
- `npx prisma migrate dev`, o comando documentado, **falhava**: Prisma 7 exige `prisma.config.ts`. Criado, junto com a migration inicial (`prisma/migrations/`, que não existia).
- `npm run build` gerava `dist/src/main.js` porque o `prisma/seed.ts` entrava na compilação; `npm run start:prod` (`node dist/main`) nunca funcionou. Corrigido em `tsconfig.build.json`.
- `getMe` estava em `/v1/auth/me`; o contrato diz `/v1/me`. O app teria tomado 404 ao restaurar a sessão e deslogado o mecânico a cada abertura.

Implantação: `api/Dockerfile` (multi-stage, usuário não-root, `prisma migrate deploy` antes de subir), `deploy/nginx/nginx.conf` (80 redireciona para 443; `/dev/` devolve 404), `docker-compose.prod.yml` (API + Postgres + Nginx, healthchecks). Validado subindo a pilha inteira com certificado autoassinado: migration aplicada na subida, HTTPS e redirect pelo Nginx, `/dev/login` bloqueado, chamada autenticada passando pelo proxy.

**Não validado:** certificado TLS real (a pilha foi testada com autoassinado descartável; o de produção — ex.: Let's Encrypt — fica em `deploy/certs/`, fora do git); o login Google de ponta a ponta (sem `GOOGLE_CLIENT_ID`; o smoke usou JWT assinado para o usuário do seed); rodar `docker compose` num servidor de verdade; `refresh` com token rotacionado contra o banco real (coberto só por teste unitário).

Pontos conhecidos, não corrigidos: mensagens de 401/404 padrão do Nest saem em inglês (`"Unauthorized"`) — o app não as exibe, mas o contrato pede português; um JWT válido de usuário apagado do banco dá 500 em `/v1/me` em vez de 401; "uma OS ativa por veículo" é checada no service, sem índice único parcial, então duas criações simultâneas com chaves diferentes poderiam passar.

## Fase 14 — Primeira execução no emulador, excluir peça e "Todas as OS"

**Status:** ✅ concluída

O app rodou pela primeira vez num emulador Android (Pixel, Google Play): build do dev client, login real com a conta Google, Pátio, estoque. Foi preciso resolver o build nativo no Windows, que tinha três problemas que ninguém veria sem compilar:

- `react-native-bluetooth-classic` não compilava (o Android Gradle Plugin novo não gera `BuildConfig` em bibliotecas). Corrigido por um config plugin, `app/plugins/withBluetoothClassicBuildConfig.js`, sem tocar em `node_modules`.
- O build C++ do React Native estourava o limite de 260 caracteres de caminho: o Windows já tinha `LongPathsEnabled`, mas o `ninja` 1.10 do CMake 3.22.1 do SDK não o usa. Corrigido apontando o app para o CMake 3.31.6 (ninja 1.12), via `app/plugins/withNewerCmake.js`. **Requer** `sdkmanager "cmake;3.31.6"` na máquina.
- Um `subst` para encurtar o caminho **não** resolve (o Node devolve alguns caminhos como `E:\` e o build mistura as raízes); não usar.

Funcionalidades pedidas depois de usar o app (contrato e SPEC primeiro, teste antes do código):

- **RF-21 · Excluir peça** (`deleteProduct`, `DELETE /v1/products/{id}`, 204). Exclusão **lógica** (`products.deleted_at`, migration `product_soft_delete`): a peça some da lista e da busca, e não aceita ajuste nem item novo (404); as OS antigas que a usaram continuam com o item. O filtro `deleted_at IS NULL` está na própria baixa atômica de estoque, não só numa checagem depois. No app, o botão Excluir pede confirmação.
- **RF-22 · "Todas as OS"**: tela nova com filtro (Todas, Abertas, Em andamento, Concluídas, Canceladas), data de abertura, vazio por filtro, paginação ao rolar e erro de "carregar mais" sem perder a lista. Não precisou de endpoint novo: usa `listServiceOrders` com `status` repetido (o padrão do servidor, sem `status`, esconde as fechadas, então "Todas" envia os quatro).

Validado: contra o Postgres real (exclusão com OS antiga intacta, 404 em peça excluída, uso em item novo bloqueado); no emulador (as duas telas, o diálogo de confirmação e a exclusão de fato, conferida no banco); testes (API 52 + 10 e2e, app 134).

Lição para quem mexe no schema: no Prisma 7, `migrate dev` **não** regenera o client. Rode `npx prisma generate` e rebuilde, senão o servidor sobe com o client antigo e dá 500 (aconteceu nesta fase).

**Não validado:** BLE/Bluetooth no emulador (ele não tem Bluetooth); o restante do loop de pareamento continua dependendo de um celular real e do ESP32.

## Fase 15 — Roteiro de deploy na nuvem do LARCC

**Status:** ✅ scripts prontos e testados localmente; **nada foi executado dentro do LARCC**

O LARCC liberou uma VM Ubuntu **até dezembro**, com manutenção depois do período letivo: serve para a entrega e para testes, não como casa definitiva. A VM só tem IP interno; o e-mail deles aceita pedidos de liberação de porta no firewall, e é isso que permite o celular chegar na API.

`deploy/larcc/`: `bootstrap.sh` (Docker, git, firewall da VM, código em `/opt/autoos`), `deploy.sh` (gera `JWT_SECRET` e a senha do Postgres na primeira vez, garante o certificado, sobe o stack, espera a API e roda o seed; rodar de novo só atualiza e **não** troca segredos), `backup.sh` (dump comprimido, verificado, 14 dias de retenção) e `restore.sh`, mais um `README.md` com o acesso em dois saltos (`ProxyJump`), o pedido ao LARCC, certificado, backup e o que fazer ao terminar.

Validado: `shellcheck` sem avisos; `deploy.sh` numa cópia limpa do repositório com Docker (primeira execução e reexecução; segredos preservados; usuário do seed sem duplicar); backup, **apagar um registro, restaurar e conferir que voltou**, com a API reconectando.

Bugs achados ao testar: o `openssl` tinha o erro redirecionado para `/dev/null` (falha silenciosa; agora mostra a causa) e scripts `.sh` com fim de linha CRLF quebram no Linux, então o `.gitattributes` passou a forçar LF.

**Não validado:** `bootstrap.sh` numa VM Ubuntu real (usa `apt`; o nome do pacote do plugin `docker compose` varia por versão e o script tenta as alternativas); a rede e o firewall do LARCC; certificado de verdade (Let's Encrypt) e renovação automática; um broker MQTT (o manual não cita nenhum).

## O que não vai ficar pronto para produção nesta rodada (por design, não por atraso)

- **Credenciais reais** (Google OAuth, broker LARCC) — fora do escopo desta rodada, conforme combinado.
- **Hardware físico**: o firmware vai rodar em simulação de leitura; validação com MCP2515 + veículo real é a próxima etapa fora do código.
- **iOS**: fora do escopo da V1 (ver RNF-15).
- **Aparelho Android**: sem Android SDK nesta máquina, o app nunca foi instalado nem aberto; é o primeiro passo de quem continuar (`npm run android` em `app/`).
