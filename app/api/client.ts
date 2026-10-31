import { ApiError, parseErrorBody } from './errors';
import type { TokenPair } from './types';

// Armazenamento seguro (Keychain/Keystore) — interface pra poder testar sem nativo.
export interface TokenStore {
  get(): Promise<TokenPair | null>;
  set(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  // Refresh falhou de vez (RF-02): o app volta ao login.
  onSessionExpired: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | string[] | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  // false = rota pública (login/refresh).
  auth?: boolean;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RawResponse {
  status: number;
  body: unknown;
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  // Várias chamadas podem tomar 401 juntas; só um refresh por vez, senão a
  // rotação (RF-02) trataria o segundo uso como token roubado.
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  patch<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, options);
  }

  delete(path: string, options?: RequestOptions): Promise<void> {
    return this.request<void>('DELETE', path, options);
  }

  private async request<T>(
    method: Method,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const auth = options.auth ?? true;
    const first = await this.send(method, path, options);

    if (first.status === 401 && auth) {
      // Repete a chamada original uma vez (RF-02).
      const refreshed = await this.refreshOnce();
      if (!refreshed) {
        this.options.onSessionExpired();
        throw parseErrorBody(401, first.body);
      }
      const second = await this.send(method, path, options);
      return this.unwrap<T>(second);
    }
    return this.unwrap<T>(first);
  }

  private unwrap<T>(response: RawResponse): T {
    if (response.status >= 200 && response.status < 300) {
      return response.body as T;
    }
    throw parseErrorBody(response.status, response.body);
  }

  private async send(
    method: Method,
    path: string,
    options: RequestOptions,
  ): Promise<RawResponse> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options.auth ?? true) {
      const tokens = await this.options.tokens.get();
      if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        this.options.baseUrl + path + buildQuery(options.query),
        {
          method,
          headers,
          body:
            options.body !== undefined
              ? JSON.stringify(options.body)
              : undefined,
          signal: controller.signal,
        },
      );
      return { status: response.status, body: await readJson(response) };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(0, 'TIMEOUT', 'Tempo esgotado.');
      }
      throw new ApiError(0, 'NETWORK', 'Sem conexão.');
    } finally {
      clearTimeout(timer);
    }
  }

  private refreshOnce(): Promise<boolean> {
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  // true = par novo gravado. false = refreshToken inválido: encerra a sessão.
  // Falha de rede/5xx propaga: sem rede, ninguém é deslogado.
  private async refresh(): Promise<boolean> {
    const current = await this.options.tokens.get();
    if (!current) return false;
    const response = await this.send('POST', '/auth/refresh', {
      auth: false,
      body: { refreshToken: current.refreshToken },
    });
    if (response.status >= 500) {
      throw parseErrorBody(response.status, response.body);
    }
    if (response.status !== 200) {
      await this.options.tokens.clear();
      return false;
    }
    await this.options.tokens.set(response.body as TokenPair);
    return true;
  }
}

function buildQuery(query: RequestOptions['query']): string {
  if (!query) return '';
  const params: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      params.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
      );
    }
  }
  return params.length > 0 ? `?${params.join('&')}` : '';
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
