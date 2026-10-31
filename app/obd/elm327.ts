import type { ObdReading } from './types';

// Protocolo ELM327 (mqtt-topics.md §1.2). Aqui só o texto: montar comando e
// ler resposta. O transporte (Bluetooth Classic/SPP) fica no reader.

export const INIT_COMMANDS = [
  'ATZ', // reset
  'ATE0', // sem eco
  'ATL0', // sem line feed
  'ATS0', // sem espaços
  'ATH0', // sem headers
  'ATSP0', // protocolo automático
] as const;

export const PID = {
  rpm: '010C',
  engineTemperature: '0105',
  batteryVoltage: '0142',
  // Odômetro (PID A6, J1979-DA). NÃO usar 0131: é "distância desde que os
  // códigos foram apagados", não a quilometragem — gravaria lixo em
  // vehicles.reference_mileage (RF-13).
  odometer: '01A6',
  dtc: '03',
} as const;

// Respostas que significam "este PID não existe / não respondeu" (RF-17:
// campo fica "indisponível", não quebra o snapshot).
const NO_DATA =
  /NO DATA|UNABLE TO CONNECT|BUS INIT|CAN ERROR|\?|STOPPED|ERROR/i;

// Texto cru → linhas de bytes. Tira o prompt '>', o 'SEARCHING...' e o eco.
function toByteLines(raw: string): number[][] {
  const lines: number[][] = [];
  for (const line of raw.split(/[\r\n]+/)) {
    const text = line.replace(/>/g, '').trim();
    if (!text || /SEARCHING/i.test(text)) continue;
    if (NO_DATA.test(text)) return [];
    // Aceita "41 0C 1A F8" e "410C1AF8".
    const hex = text.replace(/\s+/g, '');
    if (!/^[0-9A-Fa-f]+$/.test(hex) || hex.length % 2 !== 0) continue;
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    lines.push(bytes);
  }
  return lines;
}

// Acha a linha "41 <pid> ..." e devolve os bytes de dados depois dela.
function dataBytes(raw: string, pid: number): number[] | null {
  for (const bytes of toByteLines(raw)) {
    if (bytes[0] === 0x41 && bytes[1] === pid) return bytes.slice(2);
  }
  return null;
}

export function parseRpm(raw: string): number | undefined {
  const d = dataBytes(raw, 0x0c);
  if (!d || d.length < 2) return undefined;
  return (d[0]! * 256 + d[1]!) / 4;
}

export function parseEngineTemperature(raw: string): number | undefined {
  const d = dataBytes(raw, 0x05);
  if (!d || d.length < 1) return undefined;
  return d[0]! - 40;
}

export function parseBatteryVoltage(raw: string): number | undefined {
  const d = dataBytes(raw, 0x42);
  if (!d || d.length < 2) return undefined;
  return (d[0]! * 256 + d[1]!) / 1000;
}

export function parseOdometer(raw: string): number | undefined {
  const d = dataBytes(raw, 0xa6);
  if (!d || d.length < 4) return undefined;
  const tenths = ((d[0]! * 256 + d[1]!) * 256 + d[2]!) * 256 + d[3]!;
  return Math.round(tenths / 10);
}

// Modo 03: "43 <pares de bytes>". Cada par vira um código (J2012):
// 2 bits da letra (P/C/B/U), 2 bits do 1º dígito, 3 nibbles. 0000 é padding.
// Em CAN algumas ECUs mandam um byte de contagem depois do 43; nesse caso o
// resto fica com tamanho ímpar e o byte inicial é descartado.
// NÃO VALIDADO em veículo real — ver docs/PHASES.md (Fase 11).
export function parseDtcs(raw: string): string[] {
  const codes: string[] = [];
  for (const bytes of toByteLines(raw)) {
    if (bytes[0] !== 0x43) continue;
    let rest = bytes.slice(1);
    if (rest.length % 2 === 1) rest = rest.slice(1);
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const a = rest[i]!;
      const b = rest[i + 1]!;
      if (a === 0 && b === 0) continue;
      const letter = 'PCBU'[a >> 6]!;
      const digit1 = (a >> 4) & 0x3;
      const code =
        letter +
        digit1.toString(10) +
        (a & 0xf).toString(16).toUpperCase() +
        ((b >> 4) & 0xf).toString(16).toUpperCase() +
        (b & 0xf).toString(16).toUpperCase();
      if (!codes.includes(code)) codes.push(code);
    }
  }
  return codes;
}

// Monta a leitura a partir das respostas cruas de cada comando.
export function buildReading(
  responses: {
    rpm: string;
    engineTemperature: string;
    batteryVoltage: string;
    odometer: string;
    dtc: string;
  },
  capturedAt: string,
): ObdReading {
  const reading: ObdReading = {
    dtcCodes: parseDtcs(responses.dtc),
    capturedAt,
  };
  const rpm = parseRpm(responses.rpm);
  const temp = parseEngineTemperature(responses.engineTemperature);
  const volts = parseBatteryVoltage(responses.batteryVoltage);
  const km = parseOdometer(responses.odometer);
  if (rpm !== undefined) reading.rpm = rpm;
  if (temp !== undefined) reading.engineTemperature = temp;
  if (volts !== undefined) reading.batteryVoltage = volts;
  if (km !== undefined) reading.mileage = km;
  return reading;
}
