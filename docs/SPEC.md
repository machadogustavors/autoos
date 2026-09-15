# AutoOS · SPEC.md (V1)

O que o produto faz: requisitos funcionais (Given / When / Then), estados de tela e requisitos não funcionais.

Visual: [`../DESIGN.md`](../DESIGN.md). HTTP transacional: [`../contract/openapi.yaml`](../contract/openapi.yaml). Telemetria (MQTT): [`../contract/mqtt-topics.md`](../contract/mqtt-topics.md).

Se este SPEC e o OpenAPI discordarem, **o OpenAPI ganha em path/JSON/código HTTP**. Este SPEC ganha em comportamento de produto. Corrija o perdedor no mesmo commit.

Convenção de nomes: tabela, coluna, campo JSON, enum e identificador de código são em **inglês** (ver contratos). Texto de tela, mensagem de erro e copy são em **português** — é a única coisa que o usuário final vê.

---

## Como usar este documento (humano e agente)

1. Leia o **loop da V1**. Só implemente o que está neste arquivo e no contrato (OpenAPI ou MQTT).
2. Cada requisito funcional tem **Given / When / Then**, a **operação** (HTTP ou MQTT) e os **estados de tela**.
3. Não invente campo, path, tópico ou status que não existam nos contratos.
4. Requisitos não funcionais (seção 4) fazem parte deste SPEC.
5. Prompt curto: "implemente RF-12 conforme docs/SPEC.md e `postServiceOrderTelemetry` no OpenAPI".

**Vocabulário da V1:** **OS** (ordem de serviço, não "ticket" nem "job"). **Pátio** (a lista de OS, não "feed"). **Leitura** (uma amostra de telemetria). **Dispositivo** (o leitor OBD-II — próprio ESP32 ou ELM327 de contingência).

**Loop:** autenticar → pátio (lista de OS) → criar OS (cliente + veículo) → parear dispositivo (BLE) → leitura automática anexada à OS → registrar itens → acompanhar status → concluir.

---

## 1. Problema e contexto

### 1.1 Proposta de valor

A Auto Elétrica WM (Wilson Machado) hoje abre e acompanha ordens de serviço em papel: quilometragem, condição do veículo e sintomas relatados são anotados à mão, longe do veículo, e digitados depois. Isso perde informação, não gera histórico por veículo e consome tempo do mecânico que deveria estar no reparo.

O AutoOS é o app que o mecânico abre no pátio, junto do carro: cria a OS, pluga o leitor no conector OBD-II e vê a quilometragem, temperatura do motor, tensão da bateria e códigos de falha (DTCs) aparecerem sozinhos na tela, já anexados à OS. Em paralelo, a leitura contínua de alta frequência viaja por MQTT até a infraestrutura do LARCC, formando um histórico diagnóstico por veículo sem pesar no banco transacional.

### 1.2 Usuários e papéis

| Papel | O que precisa | O que faz na V1 |
| --- | --- | --- |
| **Mecânico** | Abrir e acompanhar OS sem digitar dado do veículo à mão | Login, cria OS, pareia dispositivo, registra item, muda status |

V1 tem **um papel só**. Não há distinção de admin/gestor no app ainda — ver Known Gaps. Não há auto-cadastro: o usuário é criado direto no banco (seed) pela equipe do projeto, porque a oficina é uma só.

### 1.3 Contexto de uso mobile

Uso no pátio, entre um serviço e outro, com as mãos sujas, luz de teto variável, Wi-Fi da oficina instável. A OS não pode perder texto se a rede cair no meio da criação. O dispositivo BLE pode desconectar (o mecânico se afasta do carro) e precisa reconectar sem reiniciar o fluxo. Tela branca = app quebrado.

---

## 2. Requisitos funcionais (V1)

Cada RF abaixo tem **Given / When / Then**. Isso é o requisito.

```text
ID · nome curto
O que é (uma ou duas frases)
Given: mundo antes
When: ação da pessoa (ou evento do dispositivo)
Then: resultado observável
Regras: limites e recusas
Falhas: o que a tela faz quando quebra
Contrato: operationId (HTTP) ou tópico (MQTT)
Estados: se a tela tiver lista, envio ou conexão
```

### 2.1 Autenticação

**RF-01 · Login por e-mail e senha**

Sem Google Sign-In (isso é para campus, não para uma oficina). O mecânico entra com credencial criada no servidor.

Given: usuário cadastrado no banco.
When: envia `{ email, password }` para `postLogin`.
Then: recebe `{ accessToken, refreshToken, user }`.

Regras: `accessToken` expira em minutos, não em horas (ver RNF-01). O app guarda os dois tokens em armazenamento seguro (`expo-secure-store`), nunca em `AsyncStorage` puro.
Falhas: 401 credencial inválida — mensagem única, não revela se o e-mail existe.
Contrato: `postLogin`
Estados: erro de formulário, loading no botão.

**RF-02 · Renovar sessão sem novo login**

App nativo não tem cookie de 8 horas. Quando o `accessToken` expira, o app troca silenciosamente.

Given: `accessToken` expirado, `refreshToken` ainda válido.
When: uma chamada autenticada devolve 401.
Then: o app chama `postRefreshToken` com o `refreshToken`, recebe um novo par e repete a chamada original uma vez.

Regras: se o `refreshToken` também estiver inválido/expirado, desloga e volta ao login. Rotação: cada uso de `refreshToken` marca o registro em `refresh_tokens` como usado e emite um novo; reapresentar um `refreshToken` já usado é tratado como possível roubo e revoga todos os tokens daquele usuário.
Falhas: refresh falhou duas vezes seguidas → sessão encerrada, sem loop de retry.
Contrato: `postRefreshToken`

### 2.2 Clientes e veículos

**RF-03 · Cadastrar cliente na hora**

Criar OS não pode esperar um cadastro em outra tela. Se o cliente não existe, nasce ali.

Given: formulário de nova OS.
When: busca o cliente pelo nome/telefone e não encontra.
Then: pode cadastrar nome e telefone direto no mesmo fluxo, sem sair da tela de nova OS.

Regras: `name` obrigatório. `phone` opcional na V1, mas recomendado (contato sobre o andamento).
Falhas: 400 por campo.
Contrato: `postCustomer` · `listCustomers` (busca por nome)

**RF-04 · Cadastrar veículo por placa**

A placa identifica o veículo e amarra o histórico de telemetria.

Given: cliente selecionado no fluxo de nova OS.
When: informa placa e, se novo, marca/modelo/ano/cor/quilometragem atual.
Then: veículo criado (ou reaproveitado, se a placa já existir para esse cliente).

Regras: `plate` única por veículo. Formato validado (Mercosul ou padrão antigo). `referenceMileage` é só o valor informado manualmente na primeira vez — depois que houver leitura de telemetria, ela é a fonte preferida (RF-13).
Falhas: 409 se a placa já pertencer a outro cliente (pede confirmação humana, não sobrescreve sozinho).
Contrato: `postVehicle` · `listVehicles` (busca por placa)

### 2.3 Pátio e ordens de serviço

**RF-05 · Pátio**

A lista padrão mostra o que está em aberto, não um histórico completo.

Given: mecânico autenticado.
When: abre o pátio.
Then: vê OS `open` e `in_progress`, mais recente primeiro.

Regras: `completed` e `cancelled` não entram no pátio padrão (ficam no histórico do veículo, RF-18). Paginação: `after` + `limit` (20, máx. 50).
Estados: loading (esqueleto), vazio real, erro, offline com cache.
Contrato: `listServiceOrders`

**RF-06 · Card de OS**

Given: uma OS no pátio.
When: o mecânico olha o card, sem abrir.
Then: vê placa, cliente, marca/modelo, status, e um indicador se a última leitura trouxe DTC.

Regras: schema `ServiceOrderCard`. Sem itens, sem telemetria completa — isso é do detalhe.
Contrato: schema `ServiceOrderCard`

**RF-07 · Criar OS**

Given: mecânico autenticado, cliente e veículo definidos (existentes ou criados na hora, RF-03/RF-04).
When: envia `postServiceOrder` com `customerId`, `vehicleId` e `description` opcional.
Then: 201, status inicial `open`, `id` e timestamps gerados no servidor.

Regras: um veículo pode ter várias OS ao longo do tempo (histórico), mas só uma OS `open`/`in_progress` por vez — tentar abrir uma segunda com o mesmo veículo enquanto a primeira segue ativa é 409.
Falhas: 400 por campo; 409 veículo já tem OS ativa.
Contrato: `postServiceOrder`

**RF-08 · Rascunho e idempotência**

Wi-Fi da oficina cai. O texto da OS não pode sumir.

Given: formulário de nova OS preenchido; a chamada falha (timeout, 5xx, offline).
When: a criação não completa.
Then: o rascunho fica salvo no aparelho; banner + "Tentar novamente". O app manda `Idempotency-Key` (UUID); o servidor devolve o mesmo recurso se a chave se repetir.

Regras: 400 de validação não entra em retry automático.
Estados: falha ao criar.
Contrato: `postServiceOrder` + header `Idempotency-Key`

**RF-09 · Detalhe da OS**

Given: o mecânico toca um card.
When: abre a OS.
Then: vê descrição, status, cliente, veículo, itens (RF-11), e o painel de telemetria com a última leitura (RF-13).

Estados: loading, erro, offline (detalhe em cache se já visitado).
Contrato: `getServiceOrder`

**RF-10 · Máquina de estados da OS**

Given: OS existente.
When: o mecânico muda o status.
Then: o servidor só aceita as transições abaixo; o resto é 409.

```text
open → in_progress → completed
open → cancelled
in_progress → cancelled
```

Regras: `completed` e `cancelled` não recebem novo item (RF-11).
Contrato: `patchServiceOrder`

**RF-11 · Itens da OS (peça ou serviço, sem preço)**

A V1 registra **o que foi feito**, não quanto custou. Sem preço, sem fornecedor, sem nota de compra — mas peça usada **baixa do estoque** (RF-11a).

Given: OS `open` ou `in_progress`.
When: adiciona item com `type` (`part` | `service`) e `description`. Se `type = part`, informa também `productId` (peça vinda do estoque, RF-19) **ou** deixa em branco (peça avulsa, sem controle de estoque) e `quantity` opcional em qualquer um dos dois casos.
Then: 201, item aparece na lista da OS. Se veio de `productId`, a quantidade do produto no estoque é decrementada (RF-11a).

Regras: OS `completed`/`cancelled` recusa novo item (409). `service` nunca tem `productId`. Editar quantidade: `patchServiceOrderItem` (não repõe nem redecrementa estoque automaticamente na V1 — ver RF-11a). Remover: `deleteServiceOrderItem` (também não repõe estoque na V1).
Falhas: 400 sem descrição; 409 OS fechada; 409 estoque insuficiente (RF-11a).
Contrato: `postServiceOrderItem` · `patchServiceOrderItem` · `deleteServiceOrderItem`

**RF-11a · Baixa automática de estoque**

Given: item `type = part` com `productId` sendo adicionado a uma OS (RF-11).
When: a quantidade pedida é maior que zero.
Then: o servidor decrementa `products.stock_quantity` na mesma transação que cria o item. Se a quantidade em estoque ficar abaixo de zero, a operação inteira falha.

Regras: a baixa é **irreversível na V1** — remover ou editar o item não repõe o estoque automaticamente (ver Known Gaps). Isso é aceitável para o escopo do projeto: o ajuste manual de estoque (RF-20) cobre a correção quando necessário.
Falhas: 409 `INSUFFICIENT_STOCK` — mensagem mostra a quantidade disponível.
Contrato: efeito colateral de `postServiceOrderItem`, sem operação própria.

### 2.4 Dispositivo IoT e telemetria

**RF-12 · Parear dispositivo via BLE**

O mecânico conecta o leitor plugado no OBD-II do veículo ao app.

Given: OS aberta no detalhe; dispositivo (ESP32 próprio, anunciando o serviço BLE do AutoOS) ligado e plugado no conector OBD-II do veículo.
When: o mecânico toca "Parear dispositivo"; o app varre BLE por perto.
Then: lista de dispositivos encontrados; ao escolher um, o app conecta (GATT) e o badge muda para "Conectado".

Regras: pareamento é **por sessão de OS**, não cadastro permanente de dispositivo — a leitura seguinte fica associada à OS que estava aberta no momento da conexão. Não existe tela de "meus dispositivos" na V1.
Falhas: timeout de conexão → "Não foi possível conectar. Tente novamente perto do veículo."; permissão de Bluetooth negada → tela explica e leva à configuração do sistema.
Estados: scanning, lista de encontrados, conectando, conectado, falha.
Contrato: não é HTTP nem MQTT — é BLE local entre app e dispositivo. GATT service/characteristic UUIDs: ver `contract/mqtt-topics.md` (seção "Do dispositivo ao app").

**RF-13 · Leitura automática anexada à OS**

O núcleo do produto: o dado do veículo aparece sozinho.

Given: dispositivo conectado (RF-12), OS aberta.
When: o dispositivo envia uma leitura pela característica BLE de telemetria.
Then: o app mostra quilometragem, temperatura do motor, tensão da bateria e DTCs no `panel-telemetry`; ao confirmar, o app envia um **snapshot** dessa leitura para a API, que a anexa à OS.

Regras: o snapshot enviado à API é **um resumo pontual** (a leitura mais recente), não o fluxo contínuo — isso vai para o LARCC (RF-14), não para o Postgres transacional. A quilometragem da leitura (`mileage`) passa a ser a referência do veículo (substitui o `referenceMileage` cadastrado manualmente em RF-04).
Falhas: leitura com PID inválido/fora de faixa → descartada, não quebra a tela; sem leitura nos primeiros 10s → mensagem "Aguardando leitura do veículo."
Estados: aguardando leitura, leitura recebida, leitura com DTC (destaque de perigo).
Contrato: `postServiceOrderTelemetry` (snapshot, HTTP)

**RF-14 · Streaming contínuo para o LARCC**

A telemetria de alta frequência não passa pelo banco transacional.

Given: dispositivo conectado e emitindo leituras continuamente.
When: cada leitura chega ao app pela característica BLE.
Then: o app publica a leitura por MQTT sobre TLS direto no broker do LARCC — em paralelo ao snapshot da RF-13, sem esperar resposta da API AutoOS.

Regras: se o MQTT falhar (sem rede, broker fora), a leitura é descartada silenciosamente para o LARCC (é dado de série temporal, não crítico como a OS) — mas o snapshot da RF-13 continua tentando ir para a API normalmente, porque esse sim faz parte da OS.
Falhas: ver RNF-04.
Contrato: ver `../contract/mqtt-topics.md`

**RF-15 · Pseudonimização antes de sair do app**

LGPD: identificador de veículo não pode viajar em texto puro para infraestrutura de terceiro.

Given: uma leitura pronta para publicar no MQTT (RF-14).
When: o app monta o payload.
Then: o campo de identificação do veículo é um hash (não a placa em texto puro); o mapeamento hash→placa vive só no banco transacional do AutoOS, nunca no LARCC.

Regras: o snapshot que vai para a API (RF-13) **pode** guardar a placa normalmente — ali é o próprio sistema, não terceiro. Só o que sai por MQTT é pseudonimizado.
Contrato: ver `../contract/mqtt-topics.md` (campo `vehicleHash`)

**RF-16 · Reconexão do dispositivo**

O mecânico se afasta do carro, o BLE cai, ele volta — o app não pode obrigar a recriar o fluxo.

Given: dispositivo estava conectado, sinal perdido.
When: o app detecta desconexão.
Then: badge muda para "Reconectando…"; o app tenta reconectar automaticamente ao mesmo dispositivo por um tempo limitado antes de voltar para a lista de busca.

Regras: leituras perdidas durante a desconexão não são reconstruídas — o histórico no LARCC simplesmente tem uma lacuna. Isso é aceitável e faz parte do que a validação da V1 mede (taxa de reconexão).
Estados: conectado, reconectando, desconectado (volta para RF-12).

**RF-17 · Fallback ELM327 (Bluetooth Classic)**

Given: dispositivo próprio (ESP32) indisponível; adaptador ELM327 comercial plugado no OBD-II.
When: o mecânico escolhe "Usar adaptador comercial" na tela de pareamento.
Then: o app conecta via Bluetooth Classic (perfil SPP) em vez de BLE, e envia comandos AT/PID no protocolo ELM327.

Regras: essa é a razão da V1 validar só em Android — iOS restringe Bluetooth Classic a acessórios certificados no programa MFi da Apple, o que inviabilizaria o fallback ELM327 nesse sistema operacional. O restante do fluxo (RF-13 a RF-16) é idêntico, independente do transporte.
Falhas: adaptador não suporta um PID esperado → aquele campo aparece como "indisponível", não quebra o snapshot inteiro.

### 2.5 Histórico

**RF-18 · Histórico diagnóstico por veículo**

Given: veículo com uma ou mais OS concluídas.
When: o mecânico abre o histórico pela placa (a partir do detalhe de uma OS atual).
Then: vê a lista de OS anteriores daquele veículo, com status, data e se cada uma teve DTC registrado.

Regras: histórico é só transacional (snapshots por OS) — a série temporal bruta fica nos painéis do LARCC, fora do app.
Contrato: `listVehicleServiceOrders`

### 2.6 Estoque

A V1 controla **quantidade de peça em estoque**, não compra nem fornecedor — esses ficam fora (ver Known Gaps, seção 6.4). Estoque entra no escopo porque toda peça usada na OS precisa refletir em alguma contagem — sem isso, o mecânico não sabe se tem a peça disponível antes de prometer o serviço.

**RF-19 · Consultar estoque**

Given: mecânico autenticado.
When: busca uma peça pelo nome, ao adicionar item a uma OS (RF-11) ou numa tela própria de estoque.
Then: vê nome e quantidade disponível de cada peça.

Regras: sem paginação por categoria/fornecedor na V1 — lista simples, busca por nome.
Contrato: `listProducts`

**RF-20 · Cadastrar e ajustar peça no estoque**

Given: mecânico autenticado.
When: cadastra uma peça nova (`name`, `stockQuantity` inicial) ou ajusta a quantidade de uma existente (entrada manual, correção de contagem, reposição comprada fora do app).
Then: 201 (nova peça) ou 200 (ajuste), quantidade atualizada.

Regras: ajuste manual é a única forma de repor estoque na V1 — não existe fluxo de "nota de compra" (isso é GMOpero, fora do AutoOS). É também a forma de corrigir uma baixa da RF-11a que não devia ter acontecido (ex.: item removido por engano).
Falhas: 400 quantidade negativa.
Contrato: `postProduct` · `patchProduct`

---

## 3. Estados de produto e falhas

Valem em **toda** tela de lista, envio ou conexão.

| Estado | O que a pessoa vê | Ação |
| --- | --- | --- |
| **Loading** | Esqueleto de cards no primeiro load. | Esperar |
| **Vazio real** | "Nenhuma OS aberta." | Botão nova OS |
| **Erro 5xx / timeout** | Mensagem na **seção** que falhou. Sem código HTTP. | Tentar novamente |
| **400 validação** | Erro no campo do formulário | Corrigir e reenviar |
| **401** | Sessão renovada em silêncio (RF-02) ou login de novo | — |
| **403 / 404** | Ação indisponível ou OS sumiu | Sem retry em loop |
| **409** | Conflito explicado em português (placa duplicada, transição inválida) | Ação alternativa |
| **Offline com cache** | Último pátio + aviso "Sem conexão" | Ler; escritas não fingem sucesso |
| **Falha ao criar OS** | Rascunho intacto no aparelho | Tentar novamente + Idempotency-Key |
| **BLE: scanning** | Lista de dispositivos crescendo | Esperar / tocar um item |
| **BLE: conectando** | Indicador no item escolhido | Esperar / cancelar |
| **BLE: conectado** | `badge-ble` verde | Ler telemetria |
| **BLE: reconectando** | `badge-ble` âmbar | Esperar; app tenta sozinho |
| **BLE: falha** | Mensagem + "Tentar novamente" | Voltar ao scan |

Cópia de exemplo:

- Vazio: "Nenhuma OS aberta. Toque em Nova OS para começar."
- Offline: "Sem conexão. O rascunho continua salvo."
- Erro: "Não foi possível carregar. Tente de novo."
- 409 veículo com OS ativa: "Este veículo já tem uma OS em andamento."
- BLE aguardando: "Aguardando leitura do veículo…"

---

## 4. Requisitos não funcionais

| ID | Regra | Como saber que passou |
| --- | --- | --- |
| **RNF-01** | `accessToken` de vida curta (minutos) + `refreshToken` de vida mais longa, rotacionado a cada uso. | Sessão sobrevive ao longo de um turno de trabalho sem novo login manual. |
| **RNF-02** | Validação de negócio repete no servidor. | Request sem campo obrigatório via curl ainda toma 400. |
| **RNF-03** | Nenhuma tela crítica termina em branco. | Pátio, detalhe e criar OS sempre têm cache, vazio ou erro. |
| **RNF-04** | Falha de publicação MQTT não derruba o fluxo transacional. | Desligar o broker do LARCC: OS e itens continuam funcionando normalmente. |
| **RNF-05** | Retry localizado. Formulário de OS não apaga texto. | 500 ao criar: texto intacto, retry só daquele POST. |
| **RNF-06** | POST de OS e de item exigem `Idempotency-Key`. | Dois POST iguais = um recurso. |
| **RNF-07** | TLS em todo trânsito: HTTPS na API, MQTT sobre TLS no LARCC. | Nenhuma chamada em texto puro. |
| **RNF-08** | Identificador de veículo pseudonimizado antes de sair do app rumo ao LARCC (LGPD). | Payload MQTT sem placa em texto puro. |
| **RNF-09** | API `/v1`. | Prefixo versionado em todo path. |
| **RNF-10** | Pátio paginado (`after`, `limit` 20, máx. 50). Card ≠ detalhe. | Card sem lista de itens completa. |
| **RNF-11** | p95 de `listServiceOrders` e `getServiceOrder` abaixo de **400 ms** no servidor, com e sem ingestão simultânea de telemetria. | Medir com e sem carga de telemetria em paralelo — prova que separar telemetria do transacional (seção 6.1) realmente evita que um fluxo degrade o outro. |
| **RNF-12** | Banco **PostgreSQL** para dados transacionais; telemetria bruta em banco de séries temporais na infraestrutura do LARCC, nunca no Postgres. | Ver seção 6. |
| **RNF-13** | Sem mídia binária na V1. | Sem multipart nas rotas da V1. |
| **RNF-14** | Reconexão BLE automática por tempo limitado antes de voltar ao scan manual. | Simular queda de sinal a 5m do veículo. |
| **RNF-15** | Validação Android na V1; iOS fica de fora por restrição de Bluetooth Classic (fallback ELM327) a acessórios MFi. | Documentado no README/AGENTS; sem build iOS na V1. |
| **RNF-16** | Baixa de estoque (RF-11a) é atômica com a criação do item — nunca item criado sem baixa, nem baixa sem item. | Transação única no banco; forçar erro no meio e ver que nenhum dos dois efeitos ficou parcialmente aplicado. |

---

## 5. Contrato de API (transacional)

Arquivo: [`../contract/openapi.yaml`](../contract/openapi.yaml). Telemetria contínua: [`../contract/mqtt-topics.md`](../contract/mqtt-topics.md).

Protocolo: **REST JSON** para tudo transacional. **MQTT sobre TLS** só para o fluxo bruto de telemetria. **BLE** só entre dispositivo e app (não aparece na API).

### 5.1 Mapa (tela → operação)

| Tela / ação | Método e path | operationId |
| --- | --- | --- |
| Saúde | `GET /v1/health` | `getHealth` |
| Entrar | `POST /v1/auth/login` | `postLogin` |
| Renovar sessão | `POST /v1/auth/refresh` | `postRefreshToken` |
| Eu | `GET /v1/me` | `getMe` |
| Buscar/criar cliente | `GET/POST /v1/customers` | `listCustomers` / `postCustomer` |
| Buscar/criar veículo | `GET/POST /v1/vehicles` | `listVehicles` / `postVehicle` |
| Histórico do veículo | `GET /v1/vehicles/{id}/service-orders` | `listVehicleServiceOrders` |
| Consultar estoque | `GET /v1/products` | `listProducts` |
| Cadastrar peça | `POST /v1/products` | `postProduct` |
| Ajustar quantidade | `PATCH /v1/products/{id}` | `patchProduct` |
| Pátio | `GET /v1/service-orders` | `listServiceOrders` |
| Detalhe | `GET /v1/service-orders/{id}` | `getServiceOrder` |
| Criar OS | `POST /v1/service-orders` | `postServiceOrder` |
| Status da OS | `PATCH /v1/service-orders/{id}` | `patchServiceOrder` |
| Adicionar item | `POST /v1/service-orders/{id}/items` | `postServiceOrderItem` |
| Editar item | `PATCH /v1/service-orders/{id}/items/{itemId}` | `patchServiceOrderItem` |
| Remover item | `DELETE /v1/service-orders/{id}/items/{itemId}` | `deleteServiceOrderItem` |
| Snapshot de telemetria | `POST /v1/service-orders/{id}/telemetry` | `postServiceOrderTelemetry` |

### 5.2 Entrada e saída (resumo)

Tudo autenticado com `Authorization: Bearer <token>`, exceto `getHealth`, `postLogin` e `postRefreshToken`.

**POST /v1/auth/login** (`postLogin`) — `{ email, password }` → `{ accessToken, refreshToken, user }`. 401 credencial inválida.

**POST /v1/auth/refresh** (`postRefreshToken`) — `{ refreshToken }` → novo `{ accessToken, refreshToken }`. 401 refresh inválido/expirado.

**GET /v1/service-orders** (`listServiceOrders`) — query `status`, `after`, `limit` → `{ items: [ServiceOrderCard], paging }`.

**POST /v1/service-orders** (`postServiceOrder`) — header `Idempotency-Key`; body `customerId`, `vehicleId`, `description?` → 201 detalhe, status `open`. 409 veículo já com OS ativa.

**PATCH /v1/service-orders/{id}** (`patchServiceOrder`) — `{ status }` → 200 detalhe. 409 transição inválida.

**GET /v1/products** (`listProducts`) — query `q` (nome) → `{ items: [Product], paging }`.

**POST /v1/products** (`postProduct`) — `{ name, stockQuantity }` → 201 peça.

**PATCH /v1/products/{id}** (`patchProduct`) — `{ stockQuantity }` → 200 peça com quantidade ajustada.

**POST /v1/service-orders/{id}/items** (`postServiceOrderItem`) — `{ type, description, productId?, quantity? }` → 201 item; se `productId` informado, decrementa `stockQuantity` na mesma transação (RF-11a). 409 OS fechada; 409 `INSUFFICIENT_STOCK`.

**POST /v1/service-orders/{id}/telemetry** (`postServiceOrderTelemetry`) — snapshot `{ mileage, engineTemperature?, batteryVoltage?, dtcCodes[]?, capturedAt }` → 201, anexado à OS. Ver payload completo no OpenAPI.

JSON completo: [`../contract/openapi.yaml`](../contract/openapi.yaml). Exemplos: [`../contract/examples/`](../contract/examples/).

### 5.3 Erro padrão (todo 4xx/5xx)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Corrija os campos destacados.",
    "fields": { "description": "obrigatório" }
  }
}
```

O app mapeia `code` + HTTP para a tabela da seção 3. Nunca mostra o JSON cru.

### 5.4 Como mudar o contrato

1. Editar `contract/openapi.yaml` (transacional) ou `contract/mqtt-topics.md` (telemetria) e um exemplo em `contract/examples/`.
2. Ajustar API.
3. Ajustar o cliente (repositório, não a tela direto).
4. Atualizar a linha RF ↔ operação neste SPEC se o comportamento mudar.

---

## 6. Dados e arquitetura

### 6.1 Por que SQL (PostgreSQL) para o transacional, série temporal à parte para telemetria

A OS é relacional: cliente tem muitos veículos; veículo tem muitas OS; OS tem muitos itens; transição de status precisa ser atômica. Isso é Postgres, igual ao GMOpero.

A telemetria é o oposto: volume alto, pouca estrutura relacional entre si, consultada por janela de tempo (não por join). Por isso vai para um banco de séries temporais na infraestrutura do LARCC, e não para o Postgres — RNF-11 mede exatamente que essa separação não degrada a API transacional mesmo com telemetria fluindo em paralelo.

### 6.2 Tabelas (Postgres, transacional)

Nomes de tabela e coluna em inglês, `snake_case` — convenção do projeto (só a interface é em português).

```text
users                  id, name, email, password_hash, created_at
refresh_tokens         id, user_id, token_hash, expires_at, revoked_at (nullable),
                       created_at
                       UNIQUE (token_hash)
customers              id, name, phone, created_at
vehicles               id, customer_id, plate, brand, model, year, color,
                       reference_mileage, created_at
                       UNIQUE (plate)
service_orders         id, customer_id, vehicle_id, description, status,
                       created_at, updated_at, completed_at
products               id, name, stock_quantity, created_at, updated_at
service_order_items    id, service_order_id, type, description, product_id (nullable),
                       quantity, created_at
telemetry_snapshots    id, service_order_id, mileage, engine_temperature,
                       battery_voltage, dtc_codes (jsonb), captured_at, created_at
idempotency_keys       key, user_id, operation, resource_id, created_at
```

`refresh_tokens` guarda só o hash do token (nunca o valor em texto puro) — é o que permite a rotação da RF-02: emitir um novo marca o atual como `revoked_at`, e reuso de um token já revogado é sinal de token roubado (mata todos os tokens daquele usuário, força novo login). Sem tabela de empresa/tenant (V1 é single-tenant, ver AGENTS.md). `product_id` em `service_order_items` é nulo para item `service` e para peça avulsa sem controle de estoque; quando preenchido, a baixa (RF-11a) decrementa `products.stock_quantity` na mesma transação. Sem tabela de fornecedor, nota de compra ou pagamento — isso continua fora do escopo da V1 (ver Known Gaps).

O banco **não** guarda a série temporal bruta de telemetria — só o snapshot pontual por OS (`telemetry_snapshots`). O histórico contínuo vive no LARCC.

### 6.3 Camadas no cliente

```text
UI  →  state holder  →  repository  →  cache local
                                   →  cliente HTTP (OpenAPI)
                                   →  cliente BLE (dispositivo)
                                   →  cliente MQTT (LARCC)
```

A tela não chama `fetch`, BLE ou MQTT diretamente — sempre via repositório.

### 6.4 Known Gaps (V1 → futuro, documentado explicitamente)

- **Papéis**: só existe um papel de usuário (mecânico). Diferenciação admin/gestor (ex.: Wilson Machado ver relatório consolidado) é trabalho futuro.
- **Estoque simples, sem fornecedor/compra/pagamento**: a V1 controla `stock_quantity` por peça (RF-19/RF-20) e dá baixa ao usar uma peça na OS (RF-11a), porque isso é o mínimo pra saber se a peça está disponível na hora de montar a OS. Fornecedor, nota de compra e preço existem no domínio do GMOpero que inspira o projeto, mas não são necessários pra abrir e acompanhar uma OS — ficam para uma fase futura, se o produto crescer para o lado financeiro/compras.
- **Reposição de estoque**: só ajuste manual (RF-20). Sem fluxo de "recebimento de compra" vinculado a fornecedor.
- **Cadastro de dispositivo**: pareamento é por sessão, não há tabela de dispositivos nem vínculo permanente device↔oficina.
- **Multi-tenant**: se o AutoOS for oferecido a outras oficinas depois, precisa de `workshop_id` em várias tabelas — não existe na V1.

### 6.5 Como testar se a API está boa o bastante

| Teste | O que prova |
| --- | --- |
| Contrato: exemplos OpenAPI batem com a resposta | Agente e app não inventam JSON |
| p95 `GET /v1/service-orders` < 400 ms, com e sem telemetria em paralelo | RNF-11 — separação transacional/telemetria não degrada a API |
| Dois POST iguais com a mesma `Idempotency-Key` | Um recurso só |
| `PATCH` de transição inválida → 409 | Máquina de estados |
| Payload MQTT sem placa em texto puro | RNF-08 / LGPD |
| Reconexão BLE após queda simulada | RNF-14 |

---

## 7. Critério de pronto da V1

1. Mecânico entra com e-mail e senha.
2. Cria uma OS vinculando cliente e veículo (cadastrando na hora, se novos).
3. Pareia o dispositivo (ESP32 ou ELM327) via Bluetooth e recebe uma leitura automática anexada à OS.
4. A mesma leitura, em paralelo, chega ao broker MQTT do LARCC com identificador de veículo pseudonimizado.
5. Registra ao menos um item de serviço e um item de peça vindo do estoque; `stock_quantity` em `products` é decrementada.
6. Status vai até `completed`.
7. Wi-Fi cai durante a criação da OS: rascunho não some, retry funciona.
8. Histórico do veículo mostra a OS concluída.
9. Chat, push, upload de arquivo, preço, fornecedor, nota de compra e pagamento **não** existem.

Se um agente entregar qualquer uma dessas últimas funcionalidades, ou qualquer tela que este arquivo não descreva, o trabalho está fora do combinado.
