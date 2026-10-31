import {
  normalizePlate,
  parseMileage,
  parseQuantity,
  parseStock,
  parseYear,
  plateError,
  requiredError,
} from '../validation';

describe('plate (RF-04) — same rule as the API DTO', () => {
  it.each(['ABC1234', 'ABC1D23', 'abc1d23', 'ABC-1234', ' abc 1d23 '])(
    'accepts %s',
    (plate) => expect(plateError(plate)).toBeUndefined(),
  );

  it.each(['', 'AB1234', 'ABCD123', 'ABC12345', '1234ABC', 'ABC1DD3'])(
    'rejects "%s"',
    (plate) => expect(plateError(plate)).toBeDefined(),
  );

  it('normalizes to what the server stores', () => {
    expect(normalizePlate(' abc-1d23 ')).toBe('ABC1D23');
  });
});

describe('numeric fields', () => {
  it('quantity is optional, accepts comma, refuses negatives and junk', () => {
    expect(parseQuantity('')).toEqual({});
    expect(parseQuantity('2,5')).toEqual({ value: 2.5 });
    expect(parseQuantity('-1').error).toBeDefined();
    expect(parseQuantity('dois').error).toBeDefined();
  });

  it('stock is a non-negative integer (RF-20)', () => {
    expect(parseStock('0')).toEqual({ value: 0 });
    expect(parseStock('12')).toEqual({ value: 12 });
    expect(parseStock('-3').error).toBeDefined();
    expect(parseStock('1.5').error).toBeDefined();
    expect(parseStock('').error).toBeDefined();
  });

  it('year and mileage are optional integers', () => {
    expect(parseYear('')).toEqual({});
    expect(parseYear('2014')).toEqual({ value: 2014 });
    expect(parseYear('14').error).toBeDefined();
    expect(parseMileage('84213')).toEqual({ value: 84213 });
    expect(parseMileage('-1').error).toBeDefined();
  });

  it('required text', () => {
    expect(requiredError('  ', 'obrigatório')).toBe('obrigatório');
    expect(requiredError('x', 'obrigatório')).toBeUndefined();
  });
});
