import type { ObdReading } from './types';

// Faixas físicas plausíveis. Fora delas a leitura é descartada inteira
// (RF-13: "PID inválido/fora de faixa → descartada, não quebra a tela").
const RANGES = {
  mileage: [0, 9_999_999],
  rpm: [0, 16_383],
  engineTemperature: [-40, 215],
  batteryVoltage: [0, 32],
} as const;

// SAE J2012: P/C/B/U + 0-3 + 3 dígitos hex. Ex.: P0301.
const DTC_PATTERN = /^[PCBU][0-3][0-9A-F]{3}$/;

type NumericField = keyof typeof RANGES;

// Payload JSON de uma notificação BLE (mqtt-topics.md §1.1) → leitura validada.
// null = descartar (JSON ruim, tipo errado, fora de faixa, data inválida).
export function parseReadingPayload(text: string): ObdReading | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;

  const reading: ObdReading = { dtcCodes: [], capturedAt: '' };

  for (const field of Object.keys(RANGES) as NumericField[]) {
    const value = obj[field];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const [min, max] = RANGES[field];
    if (value < min || value > max) return null;
    reading[field] = value;
  }
  // O snapshot da API exige `mileage` inteiro (OpenAPI: integer).
  if (reading.mileage !== undefined)
    reading.mileage = Math.round(reading.mileage);

  const dtc = obj.dtcCodes;
  if (dtc !== undefined) {
    if (!Array.isArray(dtc)) return null;
    for (const code of dtc) {
      if (typeof code !== 'string' || !DTC_PATTERN.test(code)) return null;
    }
    reading.dtcCodes = dtc as string[];
  }

  if (typeof obj.capturedAt !== 'string') return null;
  if (Number.isNaN(Date.parse(obj.capturedAt))) return null;
  reading.capturedAt = obj.capturedAt;

  return reading;
}

// BLE entrega bytes em pedaços (MTU). Junta texto e devolve cada objeto JSON
// de nível raiz que fechar. Cobre os dois casos: um objeto por notificação
// (contrato) e um objeto cortado em várias notificações.
export class JsonFrameAssembler {
  private buffer = '';
  // Teto: lixo sem fechar chave não pode crescer sem limite.
  private static readonly MAX = 4096;

  push(chunk: string): string[] {
    this.buffer += chunk;
    const frames: string[] = [];

    let depth = 0;
    let inString = false;
    let escaped = false;
    let start = -1;

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}' && depth > 0) {
        depth--;
        if (depth === 0 && start >= 0) {
          frames.push(this.buffer.slice(start, i + 1));
          start = -1;
        }
      }
    }

    // Guarda só o objeto ainda aberto; o resto (lixo fora de objeto) cai.
    this.buffer = depth > 0 && start >= 0 ? this.buffer.slice(start) : '';
    if (this.buffer.length > JsonFrameAssembler.MAX) this.buffer = '';
    return frames;
  }

  reset(): void {
    this.buffer = '';
  }
}
