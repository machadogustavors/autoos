import RNBluetoothClassic, {
  type BluetoothDevice,
  type BluetoothEventSubscription,
} from 'react-native-bluetooth-classic';
import { buildReading, INIT_COMMANDS, PID } from './elm327';
import { ensureBluetoothPermissions } from './permissions';
import {
  ObdConnectionState,
  ObdDevice,
  ObdError,
  ObdReader,
  ObdReading,
  Unsubscribe,
} from './types';

// ELM327 comercial anuncia nomes como OBDII, ELM327, V-LINK, VGATE, iCar…
const ELM_NAME = /obd|elm|v-?link|vgate|icar|viecar|konnwei/i;
const COMMAND_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;
const RECONNECT_ATTEMPTS = 6;
const RECONNECT_DELAY_MS = 5_000;

// RF-17: fallback Bluetooth Classic (SPP). Mesmo contrato do BleReader — o
// resto do fluxo (RF-13 a RF-16) não sabe qual transporte está embaixo.
export class Elm327ClassicReader implements ObdReader {
  readonly transport = 'classic' as const;

  private device: BluetoothDevice | null = null;
  private target: ObdDevice | null = null;
  private dataWatch: BluetoothEventSubscription | null = null;
  private disconnectWatch: BluetoothEventSubscription | null = null;
  private polling = false;
  private intentionalDisconnect = false;
  private pending: {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  private readonly readingListeners = new Set<(r: ObdReading) => void>();
  private readonly stateListeners = new Set<(s: ObdConnectionState) => void>();

  async scan(onFound: (device: ObdDevice) => void): Promise<void> {
    await ensureBluetoothPermissions();
    await this.assertEnabled();
    this.emitState('scanning');

    const seen = new Set<string>();
    const emit = (d: BluetoothDevice) => {
      if (seen.has(d.address)) return;
      seen.add(d.address);
      onFound({
        id: d.address,
        name: d.name ?? d.address,
        transport: 'classic',
      });
    };

    // Adaptador já pareado nas configurações do Android aparece na hora.
    for (const bonded of await RNBluetoothClassic.getBondedDevices()) {
      emit(bonded);
    }
    // Não pareado: descoberta devolve a lista ao terminar (≈12 s).
    RNBluetoothClassic.startDiscovery()
      .then((found) =>
        found.filter((d) => ELM_NAME.test(d.name ?? '')).forEach(emit),
      )
      .catch(() => undefined);
  }

  async stopScan(): Promise<void> {
    await RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    if (!this.device) this.emitState('disconnected');
  }

  async connect(target: ObdDevice): Promise<void> {
    await this.stopScan();
    this.intentionalDisconnect = false;
    this.emitState('connecting');
    try {
      await this.establish(target);
    } catch (error) {
      this.emitState('disconnected');
      throw error;
    }
    this.target = target;
    this.emitState('connected');
    void this.pollLoop();
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.polling = false;
    const device = this.device;
    this.device = null;
    this.target = null;
    this.teardown();
    await device?.disconnect().catch(() => undefined);
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

  private async assertEnabled(): Promise<void> {
    if (!(await RNBluetoothClassic.isBluetoothEnabled())) {
      throw new ObdError('BLUETOOTH_OFF', 'Bluetooth desligado.');
    }
  }

  private async establish(target: ObdDevice): Promise<void> {
    this.teardown();
    try {
      // ELM327 termina toda resposta com '>': delimitador do módulo nativo.
      this.device = await RNBluetoothClassic.connectToDevice(target.id, {
        delimiter: '>',
      });
    } catch {
      throw new ObdError('CONNECT_FAILED', 'Não foi possível conectar.');
    }

    this.dataWatch = this.device.onDataReceived((event) => {
      const waiting = this.pending;
      if (!waiting) return;
      clearTimeout(waiting.timer);
      this.pending = null;
      waiting.resolve(event.data);
    });
    this.disconnectWatch = RNBluetoothClassic.onDeviceDisconnected((event) => {
      if (event.device?.address === target.id && !this.intentionalDisconnect) {
        void this.reconnect(target);
      }
    });

    try {
      for (const command of INIT_COMMANDS) await this.send(command);
    } catch {
      this.teardown();
      throw new ObdError('CONNECT_TIMEOUT', 'O adaptador não respondeu.');
    }
  }

  // Um comando por vez: escreve com \r e espera a resposta (até o '>').
  private send(command: string): Promise<string> {
    const device = this.device;
    if (!device) return Promise.reject(new Error('sem conexão'));
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error('timeout'));
      }, COMMAND_TIMEOUT_MS);
      this.pending = { resolve, reject, timer };
      device.write(`${command}\r`).catch((error: unknown) => {
        clearTimeout(timer);
        this.pending = null;
        reject(error instanceof Error ? error : new Error('write'));
      });
    });
  }

  private async pollLoop(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    while (this.polling && this.device) {
      const started = Date.now();
      try {
        const reading = buildReading(
          {
            rpm: await this.send(PID.rpm),
            engineTemperature: await this.send(PID.engineTemperature),
            batteryVoltage: await this.send(PID.batteryVoltage),
            odometer: await this.send(PID.odometer),
            dtc: await this.send(PID.dtc),
          },
          new Date().toISOString(),
        );
        this.readingListeners.forEach((l) => l(reading));
      } catch {
        // Queda no meio do ciclo: o evento de desconexão cuida de reconectar.
        if (!this.device) break;
      }
      const wait = POLL_INTERVAL_MS - (Date.now() - started);
      if (wait > 0) await delay(wait);
    }
    this.polling = false;
  }

  private async reconnect(target: ObdDevice): Promise<void> {
    this.polling = false;
    this.teardown();
    this.device = null;
    this.emitState('reconnecting');
    for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
      if (this.intentionalDisconnect) return;
      await delay(RECONNECT_DELAY_MS);
      if (this.intentionalDisconnect) return;
      try {
        await this.establish(target);
        this.emitState('connected');
        void this.pollLoop();
        return;
      } catch {
        // próxima tentativa
      }
    }
    this.target = null;
    this.emitState('disconnected');
  }

  private teardown(): void {
    this.dataWatch?.remove();
    this.disconnectWatch?.remove();
    this.dataWatch = null;
    this.disconnectWatch = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('encerrado'));
      this.pending = null;
    }
  }

  private emitState(state: ObdConnectionState): void {
    this.stateListeners.forEach((l) => l(state));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
