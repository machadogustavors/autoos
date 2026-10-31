import type { ErrorBody } from './types';

// 'NETWORK' e 'TIMEOUT' são nossos (sem resposta do servidor); o resto vem
// do `error.code` do contrato (SPEC §5.3).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  // Sem resposta útil do servidor: vale tentar de novo, e escrita não finge sucesso.
  get isTransient(): boolean {
    return (
      this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
    );
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  if (isErrorBody(body)) {
    const { code, message, fields } = body.error;
    return new ApiError(status, code, message, fields);
  }
  return new ApiError(status, 'UNKNOWN', 'Erro inesperado.');
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const error = body.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

// Copy da seção 3 do SPEC. Nunca mostra HTTP, JSON ou o `code` cru.
export function messageFor(error: unknown): string {
  if (!isApiError(error)) return 'Não foi possível carregar. Tente de novo.';
  if (error.code === 'NETWORK' || error.code === 'TIMEOUT') {
    return 'Sem conexão. Tente de novo.';
  }
  switch (error.code) {
    case 'INSUFFICIENT_STOCK':
      return error.message;
    case 'VALIDATION_ERROR':
      return 'Corrija os campos destacados.';
  }
  if (error.status === 409) return error.message;
  if (error.status === 403) return 'Ação indisponível.';
  if (error.status === 404) return 'Não encontrado. Pode ter sido removido.';
  return 'Não foi possível carregar. Tente de novo.';
}
