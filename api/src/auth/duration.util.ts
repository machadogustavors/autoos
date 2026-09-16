// Parser mínimo para strings de TTL tipo "15m", "30d" (sem trazer uma lib só
// pra isso). Usado pra calcular refresh_tokens.expires_at — o accessToken em
// si usa o parser embutido do jsonwebtoken (aceita a mesma sintaxe).
const UNIT_TO_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error(
      `Duração inválida: "${value}". Use algo como "15m" ou "30d".`,
    );
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit];
}
