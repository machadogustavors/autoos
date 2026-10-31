#pragma once

#include <stddef.h>
#include <stdint.h>

// Uma leitura do veículo. Campos opcionais ficam de fora do JSON quando o PID
// não respondeu (contract/mqtt-topics.md §1.1) — nunca vão como 0.
constexpr size_t kMaxDtcCodes = 8;
constexpr size_t kDtcLength = 5;  // "P0301"

struct Reading {
  bool hasMileage = false;
  uint32_t mileage = 0;  // km

  bool hasRpm = false;
  uint16_t rpm = 0;

  bool hasEngineTemperature = false;
  int16_t engineTemperature = 0;  // °C

  bool hasBatteryVoltage = false;
  float batteryVoltage = 0;  // V

  // [] quando não há código ativo — o JSON leva "dtcCodes":[] sempre.
  uint8_t dtcCount = 0;
  char dtcCodes[kMaxDtcCodes][kDtcLength + 1] = {};
};

// Escreve o payload JSON UTF-8 em `out`. Devolve o tamanho escrito (sem o
// terminador) ou 0 se `capacity` não bastar. Sem `capturedAt`: o ESP32 não
// tem relógio e o app carimba a chegada.
size_t serializeReading(const Reading& reading, char* out, size_t capacity);

// Faixas físicas que o app aceita (app/obd/payload.ts). Fora delas o app
// descarta a leitura inteira, então o firmware nem envia.
bool isReadingInRange(const Reading& reading);
