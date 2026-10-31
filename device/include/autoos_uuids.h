#pragma once

// GATT do dispositivo AutoOS. Mesmos valores de contract/mqtt-topics.md §1.1 e
// app/obd/uuids.ts. Mudou aqui, muda nos três no mesmo commit.
#define AUTOOS_SERVICE_UUID "b6a7d8c2-3c0d-4880-b010-7da46f99a9da"
#define AUTOOS_TELEMETRY_CHARACTERISTIC_UUID "2a7bed5d-14c0-4c82-a2c2-8f4169e13ecf"

// Nome anunciado: AutoOS-<sufixo do device> (ex.: AutoOS-A3F1).
#define AUTOOS_NAME_PREFIX "AutoOS"
