import type { BleStatus } from '../ui/BleBadge';

// Uma leitura do veículo, igual para os dois transportes (contract/mqtt-topics.md §1).
// RF-13/RF-14 não diferenciam a origem depois daqui.
export interface ObdReading {
  mileage?: number;
  rpm?: number;
  engineTemperature?: number;
  batteryVoltage?: number;
  // [] quando não há código ativo — nunca omitido.
  dtcCodes: string[];
  capturedAt: string;
}

export type ObdTransport = 'ble' | 'classic';

export interface ObdDevice {
  id: string;
  name: string;
  transport: ObdTransport;
}

export type ObdConnectionState = BleStatus;

export type Unsubscribe = () => void;

// SPEC §6.3 / mqtt-topics §1.2: pareamento trata BLE e ELM327 como uma
// interface só, com duas implementações.
export interface ObdReader {
  readonly transport: ObdTransport;
  // Varre por perto e chama onFound a cada dispositivo (sem repetir id).
  scan(onFound: (device: ObdDevice) => void): Promise<void>;
  stopScan(): Promise<void>;
  connect(device: ObdDevice): Promise<void>;
  disconnect(): Promise<void>;
  onReading(listener: (reading: ObdReading) => void): Unsubscribe;
  onState(listener: (state: ObdConnectionState) => void): Unsubscribe;
}

// Falhas que a tela traduz em copy do SPEC §2.4 (RF-12).
export type ObdErrorCode =
  'PERMISSION_DENIED' | 'BLUETOOTH_OFF' | 'CONNECT_TIMEOUT' | 'CONNECT_FAILED';

export class ObdError extends Error {
  constructor(
    readonly code: ObdErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ObdError';
  }
}
