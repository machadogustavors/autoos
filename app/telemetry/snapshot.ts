import type { TelemetrySnapshotCreate } from '../api/types';
import type { ObdReading } from '../obd/types';

// RF-13: o snapshot da API é o resumo pontual da leitura mais recente.
// `mileage` é obrigatório no contrato E vira vehicles.reference_mileage no
// servidor — sem ele (ex.: ELM327 sem odômetro) não há snapshot, em vez de
// inventar um valor.
export function toSnapshot(
  reading: ObdReading,
): TelemetrySnapshotCreate | null {
  if (reading.mileage === undefined) return null;
  return {
    mileage: reading.mileage,
    engineTemperature: reading.engineTemperature,
    batteryVoltage: reading.batteryVoltage,
    dtcCodes: reading.dtcCodes,
    capturedAt: reading.capturedAt,
  };
}
