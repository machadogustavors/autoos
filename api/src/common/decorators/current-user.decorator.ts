import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// V1 tem um papel só (mecânico) — sem `role` aqui de propósito.
// Diferenciação de papel é trabalho futuro (docs/SPEC.md §6.4).
export interface CurrentUserPayload {
  userId: string;
}

interface RequestWithUser extends Request {
  user: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
