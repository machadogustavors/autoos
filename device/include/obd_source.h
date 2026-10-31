#pragma once

#include "reading.h"

// De onde vêm as leituras. Hoje só existe a simulada; a implementação real
// (MCP2515 + CAN, PIDs 010C/0105/0142/01A6 e modo 03) entra como outra classe
// com esta mesma interface, sem mexer no BLE.
class ObdSource {
 public:
  virtual ~ObdSource() = default;
  // Preenche `out` com a leitura atual. false = nada novo ainda.
  virtual bool read(Reading& out) = 0;
};
