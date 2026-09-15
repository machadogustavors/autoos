# Contratos (V1)

Dois arquivos, um por protocolo. Nenhum dos dois é o lugar de "por que a oficina precisa disto" (isso é o SPEC) nem de pastas do app.

| Arquivo | Protocolo | Cobre |
| --- | --- | --- |
| [`openapi.yaml`](./openapi.yaml) | HTTPS (REST) | Login, cliente, veículo, OS, item, snapshot de telemetria |
| [`mqtt-topics.md`](./mqtt-topics.md) | MQTT sobre TLS | Fluxo contínuo de telemetria do app para o LARCC |

Comportamento de produto: [`../docs/SPEC.md`](../docs/SPEC.md).

O pareamento BLE entre dispositivo e app **não tem contrato aqui** — não é HTTP nem MQTT, é GATT local. As características BLE (UUIDs de serviço e leitura) ficam documentadas em `mqtt-topics.md`, seção "Do dispositivo ao app", porque descrevem o mesmo dado (a leitura de telemetria) na origem, antes de virar snapshot HTTP ou publicação MQTT.

## Como alterar um path da API

1. Edite `openapi.yaml` (path, schema, `operationId`).
2. Atualize ou adicione um JSON em `examples/`.
3. Ajuste a linha RF → `operationId` no SPEC se o comportamento mudou.
4. Só então mude API e cliente.

Não crie campo só no controller do NestJS. Recuse PR que chama URL fora deste yaml.

## Como alterar um tópico MQTT

1. Edite `mqtt-topics.md` (tópico, payload, QoS).
2. Ajuste a linha RF (RF-14/RF-15) no SPEC se o comportamento mudou.
3. Só então mude o publisher no app e o consumidor no LARCC.

## O que cada operação HTTP precisa ter

- `operationId` estável (é o nome que o SPEC e o código usam)
- request (path, query, body, headers como `Idempotency-Key`)
- response de sucesso com schema
- pelo menos um erro (400, 401, 403, 404, 409 ou 5xx)
- lista: `after`, `limit`, item **card** (não o detalhe)

## Exemplos

| Arquivo | Caso |
| --- | --- |
| [`examples/service-orders-list-200.json`](./examples/service-orders-list-200.json) | Pátio ok |
| [`examples/service-orders-create-400.json`](./examples/service-orders-create-400.json) | Criar OS sem veículo |
| [`examples/service-order-telemetry-201.json`](./examples/service-order-telemetry-201.json) | Snapshot de telemetria anexado |
| [`examples/products-list-200.json`](./examples/products-list-200.json) | Estoque de peças |
