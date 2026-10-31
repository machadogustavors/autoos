import type { ObdReading } from '../obd/types';
import { buildPayload, topicFor } from './mqttPayload';

// Fio mínimo que o publisher usa do cliente MQTT (facilita testar).
export interface MqttLink {
  publish(
    topic: string,
    message: string,
    options: { qos: 0 | 1 | 2; retain: boolean },
    callback?: (error?: Error) => void,
  ): void;
  end(force?: boolean): void;
}

export interface LarccSettings {
  url: string; // wss://… — MQTT sobre TLS (RNF-07). Sem fallback em texto puro.
  workshopId: string;
  hashKey: string;
  clientId: string;
}

// RF-14: cada leitura vai ao broker em paralelo ao snapshot HTTP, sem esperar.
// RNF-04: QUALQUER falha aqui é engolida — nunca atrasa nem derruba a OS.
export class LarccPublisher {
  private link: MqttLink | null = null;

  constructor(
    private readonly settings: LarccSettings,
    private readonly connect: (s: LarccSettings) => MqttLink,
  ) {}

  // Desligado se faltar URL/chave ou se a URL não for TLS.
  get enabled(): boolean {
    return (
      this.settings.url.startsWith('wss://') && this.settings.hashKey !== ''
    );
  }

  publish(reading: ObdReading, vehicleId: string): void {
    if (!this.enabled) return;
    try {
      const payload = buildPayload(reading, vehicleId, this.settings.hashKey);
      this.link ??= this.connect(this.settings);
      this.link.publish(
        topicFor(this.settings.workshopId, payload.vehicleHash),
        JSON.stringify(payload),
        // QoS 1, sem retain (mqtt-topics.md §2.1).
        { qos: 1, retain: false },
        // Leitura perdida é descartada; sem fila de retry na V1.
        () => undefined,
      );
    } catch {
      // Descarta em silêncio e recomeça a conexão na próxima leitura.
      this.link = null;
    }
  }

  close(): void {
    try {
      this.link?.end(true);
    } catch {
      // nada a fazer
    }
    this.link = null;
  }
}
