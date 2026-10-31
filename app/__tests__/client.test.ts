import { ApiClient, type TokenStore } from '../api/client';
import { ApiError, messageFor } from '../api/errors';
import type { TokenPair } from '../api/types';

function memoryTokens(initial: TokenPair | null): TokenStore & {
  value: TokenPair | null;
} {
  const store = {
    value: initial,
    get: async () => store.value,
    set: async (tokens: TokenPair) => {
      store.value = tokens;
    },
    clear: async () => {
      store.value = null;
    },
  };
  return store;
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
  });
}

const OLD: TokenPair = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
};
const NEW: TokenPair = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
};

function setup(fetchImpl: jest.Mock, tokens = memoryTokens(OLD)) {
  const onSessionExpired = jest.fn();
  const client = new ApiClient({
    baseUrl: 'http://api/v1',
    tokens,
    onSessionExpired,
    fetchImpl: fetchImpl,
  });
  return { client, tokens, onSessionExpired };
}

function headerOf(call: unknown[], name: string): string | undefined {
  const init = call[1] as { headers: Record<string, string> };
  return init.headers[name];
}

describe('ApiClient', () => {
  it('sends the bearer token and the Idempotency-Key header', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(json(201, { id: 'os-1' }));
    const { client } = setup(fetchImpl);

    await client.post('/service-orders', {
      body: { customerId: 'c' },
      idempotencyKey: 'key-1',
    });

    const call = fetchImpl.mock.calls[0] as unknown[];
    expect(call[0]).toBe('http://api/v1/service-orders');
    expect(headerOf(call, 'Authorization')).toBe('Bearer old-access');
    expect(headerOf(call, 'Idempotency-Key')).toBe('key-1');
  });

  it('repeats status as ?status=a&status=b and drops empty params', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(json(200, { items: [] }));
    const { client } = setup(fetchImpl);

    await client.get('/service-orders', {
      query: { status: ['open', 'in_progress'], after: undefined, q: '' },
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'http://api/v1/service-orders?status=open&status=in_progress',
    );
  });

  it('RF-02: on 401 refreshes once and repeats the original call once', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
      )
      .mockResolvedValueOnce(json(200, NEW))
      .mockResolvedValueOnce(json(200, { ok: true }));
    const { client, tokens, onSessionExpired } = setup(fetchImpl);

    await expect(client.get('/me')).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('http://api/v1/auth/refresh');
    expect(
      headerOf(fetchImpl.mock.calls[2] as unknown[], 'Authorization'),
    ).toBe('Bearer new-access');
    expect(tokens.value).toEqual(NEW);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('RF-02: refresh rejected → session ends, tokens cleared, no retry loop', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
      )
      .mockResolvedValueOnce(
        json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
      );
    const { client, tokens, onSessionExpired } = setup(fetchImpl);

    await expect(client.get('/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchImpl).toHaveBeenCalledTimes(2); // original + 1 refresh, nada além
    expect(tokens.value).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('a second 401 after a successful refresh is returned, not looped', async () => {
    const unauthorized = () =>
      json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(json(200, NEW))
      .mockResolvedValueOnce(unauthorized());
    const { client } = setup(fetchImpl);

    await expect(client.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('concurrent 401s share ONE refresh (rotation would flag reuse as theft)', async () => {
    let refreshCalls = 0;
    const fetchImpl = jest.fn(async (url: string): Promise<Response> => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        return json(200, NEW);
      }
      // Só aceita depois do refresh: o token antigo toma 401.
      return refreshCalls > 0
        ? json(200, { ok: true })
        : json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
    });
    const { client } = setup(fetchImpl);

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(refreshCalls).toBe(1);
  });

  it('no network: NETWORK error, session kept (nobody is logged out offline)', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));
    const { client, tokens, onSessionExpired } = setup(fetchImpl);

    const error = await client.get('/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'NETWORK' });
    expect((error as ApiError).isTransient).toBe(true);
    expect(tokens.value).toEqual(OLD);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('refresh hitting a 5xx does not log the user out', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }),
      )
      .mockResolvedValueOnce(
        json(503, { error: { code: 'UNAVAILABLE', message: 'x' } }),
      );
    const { client, tokens, onSessionExpired } = setup(fetchImpl);

    await expect(client.get('/me')).rejects.toMatchObject({ status: 503 });
    expect(tokens.value).toEqual(OLD);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('public routes do not send a bearer and do not trigger refresh', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        json(403, { error: { code: 'FORBIDDEN', message: 'x' } }),
      );
    const { client } = setup(fetchImpl);

    await expect(
      client.post('/auth/login', { auth: false, body: { idToken: 't' } }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      headerOf(fetchImpl.mock.calls[0] as unknown[], 'Authorization'),
    ).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('parses the contract error body (SPEC §5.3) with per-field messages', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      json(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Corrija os campos destacados.',
          fields: { name: 'obrigatório' },
        },
      }),
    );
    const { client } = setup(fetchImpl);

    await expect(client.post('/customers', { body: {} })).rejects.toMatchObject(
      {
        status: 400,
        code: 'VALIDATION_ERROR',
        fields: { name: 'obrigatório' },
      },
    );
  });

  it('handles 204 (deleteServiceOrderItem)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(json(204));
    const { client } = setup(fetchImpl);
    await expect(
      client.delete('/service-orders/1/items/2'),
    ).resolves.toBeUndefined();
  });
});

describe('messageFor (SPEC §3: never shows HTTP, JSON or code)', () => {
  it('network → "Sem conexão"', () => {
    expect(messageFor(new ApiError(0, 'NETWORK', 'x'))).toBe(
      'Sem conexão. Tente de novo.',
    );
  });

  it('INSUFFICIENT_STOCK shows the server message with the available quantity', () => {
    const msg = 'Estoque insuficiente. Disponível: 3.';
    expect(messageFor(new ApiError(409, 'INSUFFICIENT_STOCK', msg))).toBe(msg);
  });

  it('5xx and unknown errors get the generic section message', () => {
    expect(messageFor(new ApiError(500, 'INTERNAL', 'boom'))).toBe(
      'Não foi possível carregar. Tente de novo.',
    );
    expect(messageFor(new Error('qualquer coisa'))).toBe(
      'Não foi possível carregar. Tente de novo.',
    );
  });
});
