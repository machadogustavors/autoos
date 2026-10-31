import { JsonFrameAssembler, parseReadingPayload } from '../obd/payload';

const valid = {
  mileage: 84213,
  rpm: 2150,
  engineTemperature: 91,
  batteryVoltage: 12.6,
  dtcCodes: ['P0301'],
  capturedAt: '2026-10-14T14:32:01-03:00',
};

describe('parseReadingPayload (RF-13)', () => {
  it('accepts the contract payload from mqtt-topics.md §1.1', () => {
    expect(parseReadingPayload(JSON.stringify(valid))).toEqual(valid);
  });

  it('keeps dtcCodes as [] when absent, never omitted', () => {
    const { dtcCodes: _omit, ...withoutDtc } = valid;
    expect(parseReadingPayload(JSON.stringify(withoutDtc))?.dtcCodes).toEqual(
      [],
    );
  });

  it('accepts a reading without optional PIDs', () => {
    const reading = parseReadingPayload(
      JSON.stringify({
        mileage: 1000,
        dtcCodes: [],
        capturedAt: valid.capturedAt,
      }),
    );
    expect(reading).not.toBeNull();
    expect(reading?.rpm).toBeUndefined();
  });

  it.each([
    ['battery voltage out of range', { ...valid, batteryVoltage: 400 }],
    ['negative mileage', { ...valid, mileage: -1 }],
    ['engine temperature above range', { ...valid, engineTemperature: 999 }],
    ['non-numeric PID', { ...valid, rpm: '2150' }],
    ['malformed DTC', { ...valid, dtcCodes: ['XYZ'] }],
    ['dtcCodes not an array', { ...valid, dtcCodes: 'P0301' }],
    ['missing capturedAt', { ...valid, capturedAt: undefined }],
    ['invalid capturedAt', { ...valid, capturedAt: 'ontem' }],
  ])('discards the whole reading on %s', (_name, payload) => {
    expect(parseReadingPayload(JSON.stringify(payload))).toBeNull();
  });

  it('discards non-JSON and non-object payloads without throwing', () => {
    expect(parseReadingPayload('not json')).toBeNull();
    expect(parseReadingPayload('[1,2]')).toBeNull();
    expect(parseReadingPayload('null')).toBeNull();
  });

  it('rounds mileage to an integer (OpenAPI: integer)', () => {
    const reading = parseReadingPayload(
      JSON.stringify({ ...valid, mileage: 84213.6 }),
    );
    expect(reading?.mileage).toBe(84214);
  });
});

describe('JsonFrameAssembler', () => {
  const text = JSON.stringify(valid);

  it('returns one frame per whole notification', () => {
    expect(new JsonFrameAssembler().push(text)).toEqual([text]);
  });

  it('joins an object split across notifications (small MTU)', () => {
    const assembler = new JsonFrameAssembler();
    const frames: string[] = [];
    for (let i = 0; i < text.length; i += 20) {
      frames.push(...assembler.push(text.slice(i, i + 20)));
    }
    expect(frames).toEqual([text]);
  });

  it('splits two objects that arrive in a single chunk', () => {
    expect(new JsonFrameAssembler().push(text + text)).toEqual([text, text]);
  });

  it('is not fooled by braces and quotes inside strings', () => {
    const tricky = JSON.stringify({ note: 'a } b { "c"', n: 1 });
    expect(new JsonFrameAssembler().push(tricky)).toEqual([tricky]);
  });

  it('drops garbage between frames', () => {
    expect(new JsonFrameAssembler().push(`xx${text}\n\r`)).toEqual([text]);
  });

  it('does not grow without bound on an object that never closes', () => {
    const assembler = new JsonFrameAssembler();
    assembler.push('{' + 'a'.repeat(5000));
    // o buffer estourou o teto e foi zerado: um objeto novo e inteiro volta a sair
    expect(assembler.push(text)).toEqual([text]);
  });
});
