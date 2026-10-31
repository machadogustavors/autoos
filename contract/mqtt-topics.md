# Telemetria: BLE (dispositivo → app) e MQTT (app → LARCC)

Comportamento de produto: [`../docs/SPEC.md`](../docs/SPEC.md), RF-12 a RF-17. Contrato HTTP transacional: [`openapi.yaml`](./openapi.yaml).

Este arquivo cobre as **duas pernas que o OpenAPI não descreve**:

```
Dispositivo (ESP32+MCP2515, ou ELM327) ──BLE / Bluetooth Classic──▶ App
App ──MQTT sobre TLS──▶ Broker do LARCC
```

A perna App → API AutoOS (o *snapshot* pontual) é HTTP normal — está em `openapi.yaml`, operação `postServiceOrderTelemetry`.

Nomes de campo, tópico e identificador de código são em inglês, como no resto do contrato — só texto de erro/copy é em português.

---

## 1. Do dispositivo ao app (BLE)

### 1.1 Dispositivo próprio (ESP32 + MCP2515)

GATT, um serviço custom com uma característica de leitura (notify).

| Item | Valor |
| --- | --- |
| Nome do serviço (advertising) | `AutoOS-<sufixo do device>` (ex.: `AutoOS-A3F1`) |
| Service UUID | `b6a7d8c2-3c0d-4880-b010-7da46f99a9da` |
| Characteristic (telemetria, notify) | `2a7bed5d-14c0-4c82-a2c2-8f4169e13ecf` |
| MTU | O app pede 185 bytes ao conectar. O payload (~150 bytes) pode ainda chegar em pedaços; o app junta até fechar o objeto JSON. |
| Formato do payload | JSON UTF-8, um objeto por notificação |

Payload de cada notificação:

```json
{
  "mileage": 84213,
  "rpm": 2150,
  "engineTemperature": 91,
  "batteryVoltage": 12.6,
  "dtcCodes": ["P0301"],
  "capturedAt": "2026-10-14T14:32:01-03:00"
}
```

Faixas aceitas pelo app (fora delas a leitura inteira é descartada, RF-13): `mileage` 0–9 999 999 km, `rpm` 0–16 383, `engineTemperature` −40–215 °C, `batteryVoltage` 0–32 V, `dtcCodes` no formato `[PCBU][0-3][0-9A-F]{3}`.

Campos opcionais quando o PID correspondente não responde: `rpm`, `engineTemperature`, `batteryVoltage`. `mileage` é a leitura mais confiável e deve estar presente sempre que possível — é o campo que substitui a digitação manual (RF-13). `dtcCodes` é `[]` quando não há código ativo, nunca omitido.

### 1.2 Fallback ELM327 (Bluetooth Classic, perfil SPP)

Sem GATT — é um socket serial sobre RFCOMM. O app envia comandos AT/PID (protocolo ELM327 padrão: `ATZ`, `0100`, `010C` para RPM, `0105` para temperatura, `0142` para tensão, `01A6` para o odômetro, `03` para DTCs) e faz o parse da resposta hexadecimal para o mesmo formato JSON da seção 1.1 antes de seguir o fluxo (RF-13/RF-14 não diferenciam a origem depois desse ponto).

`mileage` no ELM327 vem **só** do PID `01A6` (odômetro, 0,1 km por bit). O PID `0131` (distância desde que os códigos foram apagados) **não** serve: o snapshot grava `mileage` em `vehicles.reference_mileage`, e um valor que não é a quilometragem corromperia a referência do veículo. Se o veículo não suporta `01A6`, a leitura aparece sem `mileage` e o app **não** envia snapshot à API até chegar uma leitura com `mileage`.

Por isso a lógica de pareamento (RF-12/RF-17) trata os dois caminhos como uma única interface interna (`ObdReader`), com duas implementações: `BleReader` e `Elm327ClassicReader`.

---

## 2. Do app ao LARCC (MQTT sobre TLS)

### 2.1 Conexão

| Item | Valor |
| --- | --- |
| Host/porta | `env: LARCC_MQTT_HOST` / `env: LARCC_MQTT_PORT` — pendente de credencial real do LARCC (ver Known Gaps). No app: `EXPO_PUBLIC_LARCC_MQTT_URL`, em `wss://` (MQTT sobre WebSocket seguro: React Native não abre socket TCP+TLS cru), então o broker precisa de listener WebSocket com TLS. |
| TLS | Obrigatório. Sem fallback para MQTT em texto puro, nem em desenvolvimento contra o broker real. |
| Client ID | `autoos-app-<installationId>` |
| QoS | 1 (at-least-once) — perda ocasional é aceitável (RF-14/RNF-04), duplicata não é grave para série temporal |
| Retain | Não |

### 2.2 Tópico

```
autoos/{workshopId}/vehicles/{vehicleHash}/telemetry
```

- `workshopId`: fixo na V1 (single-tenant — ver AGENTS.md), existe no tópico só para não colidir com outros projetos no mesmo broker compartilhado do LARCC.
- `vehicleHash`: **não é a placa**. É um hash (ex.: HMAC-SHA256 com chave só do AutoOS) do id interno do veículo. O mapeamento hash → placa fica só no Postgres do AutoOS (RF-15 / RNF-08). O LARCC nunca recebe a placa.

### 2.3 Payload publicado

```json
{
  "vehicleHash": "9f2a1c7e4b3d8801f6c2e9a5d47b1203",
  "serviceOrderId": null,
  "mileage": 84213,
  "rpm": 2150,
  "engineTemperature": 91,
  "batteryVoltage": 12.6,
  "dtcCodes": ["P0301"],
  "capturedAt": "2026-10-14T14:32:01-03:00"
}
```

`serviceOrderId` vai como `null` propositalmente — a OS é uma entidade transacional do AutoOS, não algo que precise existir no lado do LARCC. O que amarra a série temporal ao histórico do veículo é o `vehicleHash`, cruzado depois (dentro do AutoOS, nunca no LARCC) com `telemetry_snapshots.service_order_id` via timestamp aproximado, se necessário para auditoria.

### 2.4 Frequência

Uma publicação por notificação BLE recebida do dispositivo (não há agregação/debounce na V1). Se o dispositivo notificar a 1 Hz, o app publica a 1 Hz.

### 2.5 Falha de publicação

RNF-04: falha ao publicar (sem rede, broker indisponível, handshake TLS falho) **não** bloqueia nem atrasa o snapshot HTTP da RF-13. A leitura falha é descartada — não há fila de retry para o LARCC na V1 (ver Known Gaps).

---

## Known Gaps

- Credenciais reais do broker LARCC (host, porta, certificado) ainda não fornecidas pela infraestrutura — `.env.example` traz variáveis vazias com comentário.
- Sem fila de retry/offline para publicações MQTT perdidas — se isso virar requisito, é PR novo com fila local (ex.: SQLite) no app.
- `vehicleHash` é HMAC-SHA256 do **id interno do veículo** (não da placa) com chave só do AutoOS, truncado a 32 caracteres hex. A chave vai no app (`EXPO_PUBLIC_VEHICLE_HASH_KEY`) e, portanto, é extraível de um APK: protege a placa do LARCC, não de quem tem o APK. Rotação de chave não existe.
- O mapeamento `vehicleHash` → placa "vive só no Postgres do AutoOS" (RF-15), mas a API ainda não tem tabela nem rota para isso: hoje só dá para reconstituí-lo recalculando o HMAC a partir de `vehicles.id` com a mesma chave.
