# Telemetria: BLE (dispositivo → app) e MQTT (app → LARCC)

Comportamento de produto: [`../docs/SPEC.md`](../docs/SPEC.md), RF-12 a RF-17. Contrato HTTP transacional: [`openapi.yaml`](./openapi.yaml).

Este arquivo cobre as **duas pernas que o OpenAPI não descreve**:

```
Dispositivo (ESP32+MCP2515, ou ELM327) ──BLE / Bluetooth Classic──▶ App
App ──MQTT sobre TLS──▶ Broker do LARCC
```

A perna App → API AutoOS (o *snapshot* pontual) é HTTP normal — está em `openapi.yaml`, operação `postServiceOrderTelemetry`.

---

## 1. Do dispositivo ao app (BLE)

### 1.1 Dispositivo próprio (ESP32 + MCP2515)

GATT, um serviço custom com uma característica de leitura (notify).

| Item | Valor |
| --- | --- |
| Nome do serviço (advertising) | `AutoOS-<sufixo do device>` (ex.: `AutoOS-A3F1`) |
| Service UUID | `0000AU70-0000-1000-8000-00805F9B34FB` *(placeholder — gerar UUID real antes da implementação)* |
| Characteristic (telemetria, notify) | `0000AU71-0000-1000-8000-00805F9B34FB` *(placeholder)* |
| Formato do payload | JSON UTF-8, um objeto por notificação |

Payload de cada notificação:

```json
{
  "km": 84213,
  "rpm": 2150,
  "temperaturaMotor": 91,
  "tensaoBateria": 12.6,
  "dtcs": ["P0301"],
  "capturadoEm": "2026-10-14T14:32:01-03:00"
}
```

Campos opcionais quando o PID correspondente não responde: `rpm`, `temperaturaMotor`, `tensaoBateria`. `km` é a leitura mais confiável e deve estar presente sempre que possível — é o campo que substitui a digitação manual (RF-13). `dtcs` é `[]` quando não há código ativo, nunca omitido.

### 1.2 Fallback ELM327 (Bluetooth Classic, perfil SPP)

Sem GATT — é um socket serial sobre RFCOMM. O app envia comandos AT/PID (protocolo ELM327 padrão: `ATZ`, `0100`, `010C` para RPM, `0105` para temperatura, `0142` para tensão, `03` para DTCs) e faz o parse da resposta hexadecimal para o mesmo formato JSON da seção 1.1 antes de seguir o fluxo (RF-13/RF-14 não diferenciam a origem depois desse ponto).

Por isso a lógica de pareamento (RF-12/RF-17) trata os dois caminhos como uma única interface interna (`LeitorOBD`), com duas implementações: `LeitorBLE` e `LeitorELM327Classic`.

---

## 2. Do app ao LARCC (MQTT sobre TLS)

### 2.1 Conexão

| Item | Valor |
| --- | --- |
| Host/porta | `env: LARCC_MQTT_HOST` / `env: LARCC_MQTT_PORT` — pendente de credencial real do LARCC (ver Known Gaps) |
| TLS | Obrigatório. Sem fallback para MQTT em texto puro, nem em desenvolvimento contra o broker real. |
| Client ID | `autoos-app-<installationId>` |
| QoS | 1 (at-least-once) — perda ocasional é aceitável (RF-14/RNF-04), duplicata não é grave para série temporal |
| Retain | Não |

### 2.2 Tópico

```
autoos/{oficinaId}/veiculos/{veiculoHash}/telemetria
```

- `oficinaId`: fixo na V1 (single-tenant — ver AGENTS.md), existe no tópico só para não colidir com outros projetos no mesmo broker compartilhado do LARCC.
- `veiculoHash`: **não é a placa**. É um hash (ex.: HMAC-SHA256 com chave só do AutoOS) do id interno do veículo. O mapeamento hash → placa fica só no Postgres do AutoOS (RF-15 / RNF-08). O LARCC nunca recebe a placa.

### 2.3 Payload publicado

```json
{
  "veiculoHash": "9f2a1c7e4b3d8801f6c2e9a5d47b1203",
  "ordemServicoId": null,
  "km": 84213,
  "rpm": 2150,
  "temperaturaMotor": 91,
  "tensaoBateria": 12.6,
  "dtcs": ["P0301"],
  "capturadoEm": "2026-10-14T14:32:01-03:00"
}
```

`ordemServicoId` vai como `null` propositalmente — a OS é uma entidade transacional do AutoOS, não algo que precise existir no lado do LARCC. O que amarra a série temporal ao histórico do veículo é o `veiculoHash`, cruzado depois (dentro do AutoOS, nunca no LARCC) com `telemetria_snapshots.ordem_servico_id` via timestamp aproximado, se necessário para auditoria.

### 2.4 Frequência

Uma publicação por notificação BLE recebida do dispositivo (não há agregação/debounce na V1). Se o dispositivo notificar a 1 Hz, o app publica a 1 Hz.

### 2.5 Falha de publicação

RNF-04: falha ao publicar (sem rede, broker indisponível, handshake TLS falho) **não** bloqueia nem atrasa o snapshot HTTP da RF-13. A leitura falha é descartada — não há fila de retry para o LARCC na V1 (ver Known Gaps).

---

## Known Gaps

- UUIDs de serviço/característica BLE são placeholders — gerar valores reais (`uuidgen`) antes de programar o firmware, e atualizar este arquivo no mesmo commit.
- Credenciais reais do broker LARCC (host, porta, certificado) ainda não fornecidas pela infraestrutura — `.env.example` traz variáveis vazias com comentário.
- Sem fila de retry/offline para publicações MQTT perdidas — se isso virar requisito, é PR novo com fila local (ex.: SQLite) no app.
- Algoritmo exato de hash de `veiculoHash` (HMAC vs. hash simples, rotação de chave) ainda não decidido — hoje é placeholder conceitual, não implementação.
