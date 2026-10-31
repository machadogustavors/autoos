import type { ObdReading } from '../obd/types';
import { LarccPublisher, type MqttLink } from '../telemetry/larccPublisher';
import { buildPayload, topicFor } from '../telemetry/mqttPayload';
import { toSnapshot } from '../telemetry/snapshot';
import { vehicleHash } from '../telemetry/vehicleHash';

const reading: ObdReading = {
  mileage: 84213,
  rpm: 2150,
  engineTemperature: 91,
  batteryVoltage: 12.6,
  dtcCodes: ['P0301'],
  capturedAt: '2026-10-14T14:32:01-03:00',
};
const VEHICLE_ID = '01J8Z9K3F5N7Q2R4S6T8V0W1A1';
const KEY = 'chave-de-teste';

describe('vehicleHash (RF-15 / RNF-08)', () => {
  it('is deterministic and 32 hex chars', () => {
    const a = vehicleHash(VEHICLE_ID, KEY);
    expect(a).toBe(vehicleHash(VEHICLE_ID, KEY));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it('differs per vehicle and per key', () => {
    expect(vehicleHash('outro-veiculo', KEY)).not.toBe(
      vehicleHash(VEHICLE_ID, KEY),
    );
    expect(vehicleHash(VEHICLE_ID, 'outra-chave')).not.toBe(
      vehicleHash(VEHICLE_ID, KEY),
    );
  });

  it('matches the HMAC-SHA256 reference vector (RFC 4231, case 2)', () => {
    // key "Jefe", data "what do ya want for nothing?" → 5bdcc146bf60754e6a042426089575c7…
    expect(vehicleHash('what do ya want for nothing?', 'Jefe')).toBe(
      '5bdcc146bf60754e6a042426089575c7',
    );
  });
});

describe('MQTT payload (contract/mqtt-topics.md §2)', () => {
  it('has exactly the contract fields, with serviceOrderId null', () => {
    const payload = buildPayload(reading, VEHICLE_ID, KEY);
    expect(Object.keys(payload).sort()).toEqual(
      [
        'vehicleHash',
        'serviceOrderId',
        'mileage',
        'rpm',
        'engineTemperature',
        'batteryVoltage',
        'dtcCodes',
        'capturedAt',
      ].sort(),
    );
    expect(payload.serviceOrderId).toBeNull();
  });

  it('never carries the plate or the raw vehicle id (RNF-08)', () => {
    const json = JSON.stringify(buildPayload(reading, VEHICLE_ID, KEY));
    expect(json).not.toContain(VEHICLE_ID);
    expect(json).not.toMatch(/plate|placa/i);
  });

  it('topic is autoos/{workshopId}/vehicles/{vehicleHash}/telemetry', () => {
    expect(topicFor('wm', 'abc')).toBe('autoos/wm/vehicles/abc/telemetry');
  });
});

describe('LarccPublisher (RF-14 / RNF-04 / RNF-07)', () => {
  const settings = {
    url: 'wss://broker.larcc.example/mqtt',
    workshopId: 'wm',
    hashKey: KEY,
    clientId: 'autoos-app-test',
  };

  function fakeLink() {
    const link: MqttLink & { publish: jest.Mock; end: jest.Mock } = {
      publish: jest.fn(),
      end: jest.fn(),
    };
    return link;
  }

  it('publishes QoS 1, no retain, to the pseudonymized topic', () => {
    const link = fakeLink();
    const publisher = new LarccPublisher(settings, () => link);
    publisher.publish(reading, VEHICLE_ID);

    expect(link.publish).toHaveBeenCalledTimes(1);
    const [topic, message, options] = link.publish.mock.calls[0] as [
      string,
      string,
      { qos: number; retain: boolean },
    ];
    expect(topic).toBe(
      `autoos/wm/vehicles/${vehicleHash(VEHICLE_ID, KEY)}/telemetry`,
    );
    expect(options).toEqual({ qos: 1, retain: false });
    expect(JSON.parse(message)).toMatchObject({
      serviceOrderId: null,
      mileage: 84213,
    });
  });

  it('is off without TLS (no plain-text fallback, even in dev)', () => {
    const connect = jest.fn(fakeLink);
    const publisher = new LarccPublisher(
      { ...settings, url: 'ws://broker.larcc.example/mqtt' },
      connect,
    );
    publisher.publish(reading, VEHICLE_ID);
    expect(publisher.enabled).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });

  it('is off when the URL or the hash key is missing', () => {
    expect(new LarccPublisher({ ...settings, url: '' }, fakeLink).enabled).toBe(
      false,
    );
    expect(
      new LarccPublisher({ ...settings, hashKey: '' }, fakeLink).enabled,
    ).toBe(false);
  });

  it('swallows a publish failure — the transactional flow must not break', () => {
    const link = fakeLink();
    link.publish.mockImplementation(() => {
      throw new Error('broker fora do ar');
    });
    const publisher = new LarccPublisher(settings, () => link);
    expect(() => publisher.publish(reading, VEHICLE_ID)).not.toThrow();
  });

  it('swallows a connect failure and tries again on the next reading', () => {
    let attempts = 0;
    const link = fakeLink();
    const publisher = new LarccPublisher(settings, () => {
      attempts++;
      if (attempts === 1) throw new Error('handshake TLS falhou');
      return link;
    });
    expect(() => publisher.publish(reading, VEHICLE_ID)).not.toThrow();
    publisher.publish(reading, VEHICLE_ID);
    expect(link.publish).toHaveBeenCalledTimes(1);
  });
});

describe('toSnapshot (RF-13)', () => {
  it('maps the latest reading to the API snapshot', () => {
    expect(toSnapshot(reading)).toEqual({
      mileage: 84213,
      engineTemperature: 91,
      batteryVoltage: 12.6,
      dtcCodes: ['P0301'],
      capturedAt: reading.capturedAt,
    });
  });

  it('does not send rpm (not part of the HTTP snapshot contract)', () => {
    expect(toSnapshot(reading)).not.toHaveProperty('rpm');
  });

  it('returns null without mileage instead of inventing one', () => {
    const { mileage: _omit, ...noMileage } = reading;
    expect(toSnapshot(noMileage)).toBeNull();
  });
});
