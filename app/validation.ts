// Validação de formulário no app. O servidor repete tudo (RNF-02) — isto só
// evita ida e volta à toa e aponta o campo.

// Padrão antigo (ABC1234) ou Mercosul (ABC1D23) — igual ao DTO da API (RF-04).
const PLATE_PATTERN = /^[A-Z]{3}(\d{4}|\d[A-Z]\d{2})$/;

export function normalizePlate(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function plateError(input: string): string | undefined {
  if (!input.trim()) return 'Informe a placa.';
  return PLATE_PATTERN.test(normalizePlate(input))
    ? undefined
    : 'Placa em formato inválido.';
}

export function requiredError(
  input: string,
  message: string,
): string | undefined {
  return input.trim() ? undefined : message;
}

// Quantidade opcional: vazio vale "sem quantidade"; senão número ≥ 0.
export function parseQuantity(input: string): {
  value?: number;
  error?: string;
} {
  const text = input.trim().replace(',', '.');
  if (!text) return {};
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    return { error: 'Quantidade inválida.' };
  }
  return { value };
}

export function parseStock(input: string): { value?: number; error?: string } {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return { error: 'Informe um número inteiro.' };
  return { value: Number(text) };
}

export function parseYear(input: string): { value?: number; error?: string } {
  const text = input.trim();
  if (!text) return {};
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1900 || value > 2100) {
    return { error: 'Ano inválido.' };
  }
  return { value };
}

export function parseMileage(input: string): {
  value?: number;
  error?: string;
} {
  const text = input.trim();
  if (!text) return {};
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) {
    return { error: 'Quilometragem inválida.' };
  }
  return { value };
}
