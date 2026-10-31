import { useCallback, useEffect, useRef, useState } from 'react';
import { messageFor } from '../api/errors';
import { ObdError } from '../obd/types';
import type {
  ObdConnectionState,
  ObdDevice,
  ObdReading,
  ObdTransport,
} from '../obd/types';
import { DeviceSession } from '../repositories/deviceSession';
import { toSnapshot } from '../telemetry/snapshot';
import { services } from './services';

// SPEC RF-13: sem leitura nos primeiros 10 s → "Aguardando leitura do veículo…".
const WAITING_HINT_MS = 10_000;

export type Failure = 'permission' | 'bluetooth-off' | 'connect' | null;

export interface DeviceSessionState {
  transport: ObdTransport;
  connection: ObdConnectionState;
  devices: ObdDevice[];
  reading: ObdReading | null;
  connectingId: string | null;
  failure: Failure;
  attach: { status: 'idle' | 'sending' | 'done' | 'error'; message?: string };
  waitingTooLong: boolean;
}

export function useDeviceSession(serviceOrderId: string, vehicleId?: string) {
  const [transport, setTransport] = useState<ObdTransport>('ble');
  const [connection, setConnection] =
    useState<ObdConnectionState>('disconnected');
  const [devices, setDevices] = useState<ObdDevice[]>([]);
  const [reading, setReading] = useState<ObdReading | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [waitingTooLong, setWaitingTooLong] = useState(false);
  const [attach, setAttach] = useState<DeviceSessionState['attach']>({
    status: 'idle',
  });
  const session = useRef<DeviceSession | null>(null);
  const cleanups = useRef<(() => void)[]>([]);

  const release = useCallback(() => {
    cleanups.current.forEach((fn) => fn());
    cleanups.current = [];
    void session.current?.disconnect();
    session.current = null;
  }, []);

  // Fecha o Bluetooth e o MQTT ao sair da tela (sessão de OS, não cadastro).
  useEffect(() => release, [release]);

  const open = useCallback(
    (next: ObdTransport): DeviceSession => {
      release();
      const created = new DeviceSession(next, vehicleId);
      session.current = created;
      cleanups.current = [
        created.onState(setConnection),
        created.onReading((r) => {
          setReading(r);
          setWaitingTooLong(false);
        }),
      ];
      return created;
    },
    [release, vehicleId],
  );

  const scan = useCallback(
    async (next: ObdTransport = transport) => {
      setTransport(next);
      setDevices([]);
      setFailure(null);
      setReading(null);
      const created = open(next);
      try {
        await created.scan((device) =>
          setDevices((list) =>
            list.some((d) => d.id === device.id) ? list : [...list, device],
          ),
        );
      } catch (error) {
        setFailure(
          error instanceof ObdError && error.code === 'PERMISSION_DENIED'
            ? 'permission'
            : error instanceof ObdError && error.code === 'BLUETOOTH_OFF'
              ? 'bluetooth-off'
              : 'connect',
        );
        setConnection('disconnected');
      }
    },
    [open, transport],
  );

  const connect = useCallback(async (device: ObdDevice) => {
    const current = session.current;
    if (!current) return;
    setConnectingId(device.id);
    setFailure(null);
    try {
      await current.connect(device);
      setWaitingTooLong(false);
    } catch {
      // RF-12: "Não foi possível conectar. Tente novamente perto do veículo."
      setFailure('connect');
    } finally {
      setConnectingId(null);
    }
  }, []);

  // Contagem dos 10 s depois de conectar, até a 1ª leitura.
  useEffect(() => {
    if (connection !== 'connected' || reading) return;
    const timer = setTimeout(() => setWaitingTooLong(true), WAITING_HINT_MS);
    return () => clearTimeout(timer);
  }, [connection, reading]);

  // RF-13: "ao confirmar" — o mecânico decide qual leitura anexa à OS.
  const attachReading = useCallback(async () => {
    if (!reading) return;
    const snapshot = toSnapshot(reading);
    if (!snapshot) {
      setAttach({
        status: 'error',
        message: 'O veículo não informou a quilometragem. Tente de novo.',
      });
      return;
    }
    setAttach({ status: 'sending' });
    try {
      await services.serviceOrders.postTelemetry(serviceOrderId, snapshot);
      setAttach({ status: 'done' });
    } catch (e) {
      setAttach({ status: 'error', message: messageFor(e) });
    }
  }, [reading, serviceOrderId]);

  const disconnect = useCallback(() => {
    release();
    setConnection('disconnected');
    setDevices([]);
    setReading(null);
  }, [release]);

  return {
    transport,
    connection,
    devices,
    reading,
    connectingId,
    failure,
    attach,
    waitingTooLong,
    scan,
    connect,
    attachReading,
    disconnect,
  };
}
