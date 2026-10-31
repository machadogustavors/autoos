import type { ObdReading } from '../obd/types';
import { vehicleHash } from './vehicleHash';

// contract/mqtt-topics.md §2.3. Campos exatos — não inventar.
export interface MqttTelemetryPayload {
  vehicleHash: string;
  // null de propósito: OS é entidade transacional do AutoOS, não do LARCC.
  serviceOrderId: null;
  mileage?: number;
  rpm?: number;
  engineTemperature?: number;
  batteryVoltage?: number;
  dtcCodes: string[];
  capturedAt: string;
}

export function topicFor(workshopId: string, hash: string): string {
  return `autoos/${workshopId}/vehicles/${hash}/telemetry`;
}

// Monta o payload SEM placa, SEM id de OS e SEM o vehicleId cru: só o hash.
export function buildPayload(
  reading: ObdReading,
  vehicleId: string,
  hashKey: string,
): MqttTelemetryPayload {
  return {
    vehicleHash: vehicleHash(vehicleId, hashKey),
    serviceOrderId: null,
    mileage: reading.mileage,
    rpm: reading.rpm,
    engineTemperature: reading.engineTemperature,
    batteryVoltage: reading.batteryVoltage,
    dtcCodes: reading.dtcCodes,
    capturedAt: reading.capturedAt,
  };
}
