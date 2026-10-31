#include "simulated_source.h"

#include <math.h>
#include <string.h>

#ifndef AUTOOS_NATIVE_TEST
#include <Arduino.h>
#endif

namespace {
constexpr uint32_t kDtcPeriodMs = 60000;  // alterna "com falha" / "sem falha" a cada minuto
}

bool SimulatedSource::readAt(uint32_t nowMs, Reading& out) {
  const float seconds = static_cast<float>(nowMs) / 1000.0f;

  out = Reading{};

  // Odômetro: +1 km a cada 60 s simulados (carro andando devagar).
  out.hasMileage = true;
  out.mileage = startMileage_ + nowMs / 60000u;

  // RPM oscilando entre ~800 e ~2200.
  out.hasRpm = true;
  out.rpm = static_cast<uint16_t>(1500.0f + 700.0f * sinf(seconds / 5.0f));

  // Motor esquenta de 25 °C a 90 °C em ~65 s e estabiliza.
  out.hasEngineTemperature = true;
  out.engineTemperature = static_cast<int16_t>(fminf(90.0f, 25.0f + seconds));

  // Bateria em ~12.6 V com pequena ondulação.
  out.hasBatteryVoltage = true;
  out.batteryVoltage = 12.6f + 0.2f * sinf(seconds / 9.0f);

  // Minutos pares sem falha, ímpares com P0301 (misfire cilindro 1).
  if ((nowMs / kDtcPeriodMs) % 2 == 1) {
    out.dtcCount = 1;
    strncpy(out.dtcCodes[0], "P0301", kDtcLength);
    out.dtcCodes[0][kDtcLength] = '\0';
  }
  return true;
}

#ifndef AUTOOS_NATIVE_TEST
bool SimulatedSource::read(Reading& out) { return readAt(millis(), out); }
#else
bool SimulatedSource::read(Reading& out) { return readAt(0, out); }
#endif
