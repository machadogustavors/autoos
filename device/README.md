# device/ — firmware do dispositivo AutoOS

ESP32 que expõe a telemetria do veículo por **BLE (GATT notify)**, no formato de [`contract/mqtt-topics.md`](../contract/mqtt-topics.md) §1.1. O app (`app/obd/BleReader.ts`) conecta, junta o JSON e cuida do resto.

> **Esta versão envia leituras SIMULADAS.** O MCP2515 ainda não está ligado; a quilometragem, a rotação e o resto são sintéticos. Serve para validar a perna BLE com o app, **não** como telemetria de veículo.

## O que faz

- Anuncia `AutoOS-<sufixo do MAC>` com o service UUID do contrato (UUID no anúncio, nome na resposta de scan).
- Com um app conectado, notifica 1 leitura por segundo: `mileage`, `rpm`, `engineTemperature`, `batteryVoltage`, `dtcCodes`. Campo sem resposta é **omitido**, nunca `0`; `dtcCodes` vai sempre (`[]` sem falha).
- **Não** envia `capturedAt`: o ESP32 não tem relógio; o app carimba a chegada (ver contrato).
- Se o app não negociar MTU maior, quebra o JSON em pedaços de `MTU-3` bytes; o app junta.
- Ao desconectar, volta a anunciar (o app reconecta sozinho, RF-16).
- Simulador: motor esquenta de 25 a 90 °C em ~65 s, bateria ~12,6 V, e o código `P0301` liga e desliga a cada minuto (para exercitar o `chip-dtc`).

## Compilar e testar

```bash
pip install platformio
cd device
pio test -e native      # serialização + simulador, no PC (sem placa)
pio run -e esp32dev     # compila para a placa
pio run -e esp32dev -t upload && pio device monitor
```

Os UUIDs vivem em [`include/autoos_uuids.h`](./include/autoos_uuids.h) e precisam ficar iguais a `contract/mqtt-topics.md` e `app/obd/uuids.ts`.

## O que falta (próxima etapa, fora do código)

- Ligar o **MCP2515** ao ESP32 e escrever outra implementação de `ObdSource` (`include/obd_source.h`) que consulte `010C`, `0105`, `0142`, `01A6` (odômetro) e o modo `03` — o BLE não muda.
- Validar com um veículo real: o odômetro (`01A6`) nem todo carro responde, e o formato da resposta de DTC em CAN precisa ser conferido (ver `docs/PHASES.md`, Fase 11).
- Validar o firmware numa placa de verdade com o app: quem não gravou o `.bin` numa ESP32 não pode afirmar que o anúncio, o MTU e as notificações funcionam.
