import { Buffer } from 'buffer';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { ensureBluetoothPermissions } from './permissions';
import { JsonFrameAssembler, parseReadingPayload } from './payload';
import {
  ObdConnectionState,
  ObdDevice,
  ObdError,
  ObdReader,
  ObdReading,
  Unsubscribe,
} from './types';
import {
  AUTOOS_NAME_PREFIX,
  AUTOOS_SERVICE_UUID,
  AUTOOS_TELEMETRY_CHARACTERISTIC_UUID,
} from './uuids';

const CONNECT_TIMEOUT_MS = 10_000;
// RF-16/RNF-14: reconexão automática por tempo limitado (≈30 s), depois volta ao scan.
const RECONNECT_ATTEMPTS = 6;
const RECONNECT_DELAY_MS = 5_000;
// JSON da leitura passa de 20 bytes (MTU padrão 23); pede MTU maior.
const WANTED_MTU = 185;

// RF-12/RF-13/RF-16: dispositivo próprio (ESP32), GATT com uma característica
// de telemetria em notify, payload JSON UTF-8 (mqtt-topics.md §1.1).
export class BleReader implements ObdReader {
  readonly transport = 'ble' as const;

  private manager: BleManager | null = null;
  private current: ObdDevice | null = null;
  private monitor: Subscription | null = null;
  private disconnectWatch: Subscription | null = null;
  private assembler = new JsonFrameAssembler();
  private intentionalDisconnect = false;
  private readonly seen = new Set<string>();

  private readonly readingListeners = new Set<(r: ObdReading) => void>();
  private readonly stateListeners = new Set<(s: ObdConnectionState) => void>();

  // Criado sob demanda: BleManager só pode existir com a permissão pedida.
  private ble(): BleManager {
    this.manager ??= new BleManager();
    return this.manager;
  }

  async scan(onFound: (device: ObdDevice) => void): Promise<void> {
    await ensureBluetoothPermissions();
    await this.assertPoweredOn();

    this.seen.clear();
    this.emitState('scanning');
    await this.ble().startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error || !device) return;
        const isAutoOs =
          device.name?.startsWith(AUTOOS_NAME_PREFIX) ||
          device.serviceUUIDs?.some(
            (u) => u.toLowerCase() === AUTOOS_SERVICE_UUID,
          );
        if (!isAutoOs || this.seen.has(device.id)) return;
        this.seen.add(device.id);
        onFound({
          id: device.id,
          name: device.name ?? device.localName ?? 'AutoOS',
          transport: 'ble',
        });
      },
    );
  }

  async stopScan(): Promise<void> {
    await this.manager?.stopDeviceScan();
    // 'scanning' → 'disconnected' só se nada conectou no meio.
    if (!this.current) this.emitState('disconnected');
  }

  async connect(device: ObdDevice): Promise<void> {
    await this.stopScan();
    this.intentionalDisconnect = false;
    this.emitState('connecting');
    try {
      await this.establish(device);
    } catch (error) {
      this.emitState('disconnected');
      throw error;
    }
    this.current = device;
    this.emitState('connected');
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    const device = this.current;
    this.current = null;
    this.teardown();
    if (device) {
      await this.ble()
        .cancelDeviceConnection(device.id)
        .catch(() => undefined);
    }
    this.emitState('disconnected');
  }

  onReading(listener: (reading: ObdReading) => void): Unsubscribe {
    this.readingListeners.add(listener);
    return () => this.readingListeners.delete(listener);
  }

  onState(listener: (state: ObdConnectionState) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private async assertPoweredOn(): Promise<void> {
    const state = await this.ble().state();
    if (state !== State.PoweredOn) {
      throw new ObdError('BLUETOOTH_OFF', 'Bluetooth desligado.');
    }
  }

  // Conecta, descobre serviços e assina a característica de telemetria.
  private async establish(device: ObdDevice): Promise<void> {
    this.teardown();
    this.assembler.reset();

    let connected: Device;
    try {
      connected = await this.ble().connectToDevice(device.id, {
        timeout: CONNECT_TIMEOUT_MS,
      });
      await connected.discoverAllServicesAndCharacteristics();
    } catch (error) {
      throw new ObdError(
        isTimeout(error) ? 'CONNECT_TIMEOUT' : 'CONNECT_FAILED',
        'Não foi possível conectar.',
      );
    }

    // MTU maior é desejável, não obrigatório: o assembler junta pedaços.
    await connected.requestMTU(WANTED_MTU).catch(() => undefined);

    this.monitor = connected.monitorCharacteristicForService(
      AUTOOS_SERVICE_UUID,
      AUTOOS_TELEMETRY_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const text = Buffer.from(characteristic.value, 'base64').toString(
          'utf8',
        );
        for (const frame of this.assembler.push(text)) {
          const reading = parseReadingPayload(frame);
          // Fora de faixa/inválida: descartada, a tela segue (RF-13).
          if (reading) this.readingListeners.forEach((l) => l(reading));
        }
      },
    );

    this.disconnectWatch = this.ble().onDeviceDisconnected(device.id, () => {
      if (!this.intentionalDisconnect) void this.reconnect(device);
    });
  }

  // RF-16: mesmo dispositivo, N tentativas, depois desiste e volta ao scan.
  private async reconnect(device: ObdDevice): Promise<void> {
    this.teardown();
    this.emitState('reconnecting');
    for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
      if (this.intentionalDisconnect) return;
      await delay(RECONNECT_DELAY_MS);
      if (this.intentionalDisconnect) return;
      try {
        await this.establish(device);
        this.emitState('connected');
        return;
      } catch {
        // próxima tentativa
      }
    }
    this.current = null;
    this.emitState('disconnected');
  }

  private teardown(): void {
    this.monitor?.remove();
    this.disconnectWatch?.remove();
    this.monitor = null;
    this.disconnectWatch = null;
  }

  private emitState(state: ObdConnectionState): void {
    this.stateListeners.forEach((l) => l(state));
  }
}

function isTimeout(error: unknown): boolean {
  return /timeout|timed out/i.test(String((error as Error)?.message ?? error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
