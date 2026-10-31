import mqtt, { type MqttClient } from 'mqtt';
import { config } from '../config';
import {
  LarccPublisher,
  type LarccSettings,
  type MqttLink,
} from './larccPublisher';

// MQTT sobre TLS via WebSocket (wss://): React Native não tem socket TCP+TLS
// cru. O broker do LARCC precisa expor listener WebSocket seguro.
function connectMqtt(settings: LarccSettings): MqttLink {
  const client: MqttClient = mqtt.connect(settings.url, {
    clientId: settings.clientId,
    protocolVersion: 4,
    reconnectPeriod: 5000,
    connectTimeout: 5000,
  });
  // Sem listener de 'error' o EventEmitter lançaria e derrubaria o app.
  client.on('error', () => undefined);
  return client;
}

export function createLarccPublisher(installationId: string): LarccPublisher {
  return new LarccPublisher(
    {
      url: config.larccMqttUrl,
      workshopId: config.workshopId,
      hashKey: config.vehicleHashKey,
      clientId: `autoos-app-${installationId}`,
    },
    connectMqtt,
  );
}
