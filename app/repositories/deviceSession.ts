import { BleReader } from '../obd/BleReader';
import { Elm327ClassicReader } from '../obd/Elm327ClassicReader';
import type {
  ObdConnectionState,
  ObdDevice,
  ObdReader,
  ObdReading,
  ObdTransport,
  Unsubscribe,
} from '../obd/types';
import { createLarccPublisher } from '../telemetry/larccConnection';
import type { LarccPublisher } from '../telemetry/larccPublisher';
import { getInstallationId } from '../telemetry/installationId';

// SPEC §6.3: a tela fala com isto, nunca com BLE/Bluetooth Classic/MQTT direto.
// Pareamento é por sessão de OS (RF-12): uma instância por tela de pareamento.
export class DeviceSession {
  private reader: ObdReader;
  private publisher: LarccPublisher | null = null;
  private stopPublishing: Unsubscribe | null = null;

  constructor(
    transport: ObdTransport,
    private readonly vehicleId: string | undefined,
  ) {
    this.reader =
      transport === 'ble' ? new BleReader() : new Elm327ClassicReader();
  }

  get transport(): ObdTransport {
    return this.reader.transport;
  }

  scan(onFound: (device: ObdDevice) => void): Promise<void> {
    return this.reader.scan(onFound);
  }

  stopScan(): Promise<void> {
    return this.reader.stopScan();
  }

  async connect(device: ObdDevice): Promise<void> {
    await this.reader.connect(device);
    await this.startPublishing();
  }

  async disconnect(): Promise<void> {
    this.stopPublishing?.();
    this.stopPublishing = null;
    this.publisher?.close();
    this.publisher = null;
    await this.reader.disconnect();
  }

  onReading(listener: (reading: ObdReading) => void): Unsubscribe {
    return this.reader.onReading(listener);
  }

  onState(listener: (state: ObdConnectionState) => void): Unsubscribe {
    return this.reader.onState(listener);
  }

  // RF-14: cada leitura vai ao LARCC em paralelo ao que a tela faz com ela.
  // O publisher engole qualquer erro (RNF-04); aqui nem se espera o resultado.
  private async startPublishing(): Promise<void> {
    if (!this.vehicleId || this.stopPublishing) return;
    const vehicleId = this.vehicleId;
    this.publisher = createLarccPublisher(await getInstallationId());
    this.stopPublishing = this.reader.onReading((reading) => {
      this.publisher?.publish(reading, vehicleId);
    });
  }
}
