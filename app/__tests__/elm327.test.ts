import {
  buildReading,
  parseBatteryVoltage,
  parseDtcs,
  parseEngineTemperature,
  parseOdometer,
  parseRpm,
} from '../obd/elm327';

describe('ELM327 PID parsing (RF-17)', () => {
  it('RPM: 41 0C 1A F8 → 1726', () => {
    expect(parseRpm('41 0C 1A F8\r\r>')).toBe(1726);
  });

  it('accepts responses without spaces (ATS0)', () => {
    expect(parseRpm('410C1AF8\r\r>')).toBe(1726);
  });

  it('engine temperature: A - 40', () => {
    expect(parseEngineTemperature('41 05 7B\r\r>')).toBe(83);
  });

  it('battery voltage: (A*256+B)/1000', () => {
    expect(parseBatteryVoltage('41 42 31 38\r\r>')).toBeCloseTo(12.6, 1);
  });

  it('odometer (PID A6): 4 bytes in 0.1 km', () => {
    // 0x000CDF4E = 843598 → 84359.8 km → 84360
    expect(parseOdometer('41 A6 00 0C DF 4E\r\r>')).toBe(84360);
  });

  it('ignores SEARCHING... and finds the right line among several', () => {
    const raw = 'SEARCHING...\r41 0C 0B B8\r\r>';
    expect(parseRpm(raw)).toBe(750);
  });

  it('a PID the adapter does not support is undefined, not an error', () => {
    expect(parseOdometer('NO DATA\r\r>')).toBeUndefined();
    expect(parseRpm('?\r\r>')).toBeUndefined();
    expect(parseBatteryVoltage('UNABLE TO CONNECT\r\r>')).toBeUndefined();
    expect(parseEngineTemperature('')).toBeUndefined();
  });

  it('does not take the response of a different PID', () => {
    expect(parseRpm('41 05 7B\r\r>')).toBeUndefined();
  });
});

describe('ELM327 DTC parsing (mode 03)', () => {
  it('decodes P0133 and ignores 0000 padding', () => {
    expect(parseDtcs('43 01 33 00 00 00 00\r\r>')).toEqual(['P0133']);
  });

  it('decodes the letter from the top two bits (P, C, B, U)', () => {
    // 0x4123 → C0123 ; 0x8123 → B0123 ; 0xC123 → U0123
    expect(parseDtcs('43 41 23 81 23 C1 23\r\r>')).toEqual([
      'C0123',
      'B0123',
      'U0123',
    ]);
  });

  it('decodes a two-bit first digit (P0301 and P2301)', () => {
    expect(parseDtcs('43 03 01 23 01\r\r>')).toEqual(['P0301', 'P2301']);
  });

  it('strips a leading count byte when the remainder is odd (CAN)', () => {
    expect(parseDtcs('43 01 01 33\r\r>')).toEqual(['P0133']);
  });

  it('merges several lines and drops duplicates', () => {
    expect(parseDtcs('43 01 33 00 00 00 00\r43 01 33 03 01 00 00\r>')).toEqual([
      'P0133',
      'P0301',
    ]);
  });

  it('no codes → []', () => {
    expect(parseDtcs('43 00 00 00 00 00 00\r\r>')).toEqual([]);
    expect(parseDtcs('NO DATA\r\r>')).toEqual([]);
  });
});

describe('buildReading', () => {
  const at = '2026-10-14T14:32:01.000Z';

  it('assembles the same shape as the BLE device', () => {
    const reading = buildReading(
      {
        rpm: '41 0C 1A F8',
        engineTemperature: '41 05 7B',
        batteryVoltage: '41 42 31 38',
        odometer: '41 A6 00 0C DF 4E',
        dtc: '43 01 33 00 00 00 00',
      },
      at,
    );
    expect(reading).toMatchObject({
      mileage: 84360,
      rpm: 1726,
      engineTemperature: 83,
      dtcCodes: ['P0133'],
      capturedAt: at,
    });
  });

  it('marks unsupported PIDs as missing without losing the others (RF-17)', () => {
    const reading = buildReading(
      {
        rpm: 'NO DATA',
        engineTemperature: '41 05 7B',
        batteryVoltage: 'NO DATA',
        odometer: 'NO DATA',
        dtc: '43 00 00 00 00 00 00',
      },
      at,
    );
    expect(reading.engineTemperature).toBe(83);
    expect(reading.mileage).toBeUndefined();
    expect(reading.rpm).toBeUndefined();
    expect(reading.dtcCodes).toEqual([]);
  });
});
