// GATT do dispositivo AutoOS. Mesmos valores em contract/mqtt-topics.md §1.1
// e em device/ (firmware). Mudou aqui, muda nos três no mesmo commit.
export const AUTOOS_SERVICE_UUID = 'b6a7d8c2-3c0d-4880-b010-7da46f99a9da';
export const AUTOOS_TELEMETRY_CHARACTERISTIC_UUID =
  '2a7bed5d-14c0-4c82-a2c2-8f4169e13ecf';

// Prefixo do nome anunciado: AutoOS-<sufixo> (ex.: AutoOS-A3F1).
export const AUTOOS_NAME_PREFIX = 'AutoOS';
