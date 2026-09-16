import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

// Formato de erro do contrato (SPEC §5.3 / openapi ErrorBody):
//   { error: { code, message, fields? } }
// Todo controller pode continuar lançando as exceções padrão do Nest
// (NotFoundException, ConflictException, ...) — este filtro reformata a
// resposta uma vez só, no lugar de cada handler ter que montar o JSON.
const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body: unknown = exception.getResponse();

    // Já veio no formato do contrato (ex.: `throw new ConflictException({ error: {...} })`).
    if (isErrorBody(body)) {
      response.status(status).json(body);
      return;
    }

    const code = STATUS_CODE_MAP[status] ?? 'ERROR';

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const rawMessage = body.message;

      // ValidationPipe (class-validator) manda um array de strings — vira
      // o mapa `fields`. Heurística: a mensagem padrão começa com o nome
      // do campo ("name should not be empty").
      if (Array.isArray(rawMessage)) {
        const fields: Record<string, string> = {};
        for (const msg of rawMessage as string[]) {
          const [field] = String(msg).split(' ');
          fields[field] = String(msg);
        }
        response.status(status).json({
          error: { code, message: 'Corrija os campos destacados.', fields },
        });
        return;
      }

      response
        .status(status)
        .json({ error: { code, message: String(rawMessage) } });
      return;
    }

    response
      .status(status)
      .json({ error: { code, message: exception.message } });
  }
}

function isErrorBody(
  body: unknown,
): body is { error: { code: string; message: string } } {
  return typeof body === 'object' && body !== null && 'error' in body;
}
