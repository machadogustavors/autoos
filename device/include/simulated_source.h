#pragma once

#include <stdint.h>

#include "obd_source.h"

// Leituras sintéticas e determinísticas para validar a perna BLE com o app
// sem um veículo. NÃO é telemetria real: a quilometragem é fictícia.
class SimulatedSource : public ObdSource {
 public:
  explicit SimulatedSource(uint32_t startMileage = 84213) : startMileage_(startMileage) {}

  // `nowMs` é o tempo desde o boot (millis()); parametrizado para testar.
  bool readAt(uint32_t nowMs, Reading& out);

  bool read(Reading& out) override;

 private:
  uint32_t startMileage_;
};
