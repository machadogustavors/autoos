import * as Crypto from 'expo-crypto';
import type { ApiClient, TokenStore } from '../api/client';
import { isApiError } from '../api/errors';
import type {
  AuthResponse,
  Customer,
  CustomerCreate,
  Page,
  Product,
  ProductCreate,
  ServiceOrderCard,
  ServiceOrderCreate,
  ServiceOrderDetail,
  ServiceOrderItem,
  ServiceOrderItemCreate,
  ServiceOrderStatus,
  TelemetrySnapshot,
  TelemetrySnapshotCreate,
  User,
  Vehicle,
  VehicleCreate,
} from '../api/types';
import { Cached, fetchWithCache } from './cache';

const isTransient = (error: unknown): boolean =>
  isApiError(error) && error.isTransient;

export const newIdempotencyKey = (): string => Crypto.randomUUID();

export class AuthRepository {
  constructor(
    private readonly api: ApiClient,
    private readonly tokens: TokenStore,
  ) {}

  async login(idToken: string): Promise<User> {
    const res = await this.api.post<AuthResponse>('/auth/login', {
      auth: false,
      body: { idToken },
    });
    await this.tokens.set({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    });
    return res.user;
  }

  // Restaura a sessão no boot. null = sem sessão (vai ao login).
  // Sem rede com token guardado: relança, a tela decide (não desloga à toa).
  async restore(): Promise<User | null> {
    if (!(await this.tokens.get())) return null;
    try {
      return await this.api.get<User>('/me');
    } catch (error) {
      if (isApiError(error) && error.status === 401) return null;
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.tokens.clear();
  }
}

export class CustomerRepository {
  constructor(private readonly api: ApiClient) {}

  search(q: string): Promise<Page<Customer>> {
    return this.api.get('/customers', { query: { q, limit: 20 } });
  }

  create(input: CustomerCreate): Promise<Customer> {
    return this.api.post('/customers', { body: input });
  }
}

export class VehicleRepository {
  constructor(private readonly api: ApiClient) {}

  searchByPlate(plate: string): Promise<Page<Vehicle>> {
    return this.api.get('/vehicles', { query: { plate, limit: 20 } });
  }

  create(input: VehicleCreate): Promise<Vehicle> {
    return this.api.post('/vehicles', { body: input });
  }

  history(vehicleId: string): Promise<Cached<Page<ServiceOrderCard>>> {
    return fetchWithCache(
      `vehicle-history.${vehicleId}`,
      () =>
        this.api.get<Page<ServiceOrderCard>>(
          `/vehicles/${vehicleId}/service-orders`,
          { query: { limit: 50 } },
        ),
      isTransient,
    );
  }
}

export class ProductRepository {
  constructor(private readonly api: ApiClient) {}

  list(q: string): Promise<Cached<Page<Product>>> {
    return fetchWithCache(
      `products.${q}`,
      () =>
        this.api.get<Page<Product>>('/products', {
          query: { q, limit: 50 },
        }),
      isTransient,
    );
  }

  create(input: ProductCreate): Promise<Product> {
    return this.api.post('/products', { body: input });
  }

  adjust(id: string, stockQuantity: number): Promise<Product> {
    return this.api.patch(`/products/${id}`, { body: { stockQuantity } });
  }
}

export class ServiceOrderRepository {
  constructor(private readonly api: ApiClient) {}

  // RF-05: sem filtro = open + in_progress (default do servidor).
  yard(): Promise<Cached<Page<ServiceOrderCard>>> {
    return fetchWithCache(
      'yard',
      () =>
        this.api.get<Page<ServiceOrderCard>>('/service-orders', {
          query: { limit: 20 },
        }),
      isTransient,
    );
  }

  detail(id: string): Promise<Cached<ServiceOrderDetail>> {
    return fetchWithCache(
      `service-order.${id}`,
      () => this.api.get<ServiceOrderDetail>(`/service-orders/${id}`),
      isTransient,
    );
  }

  create(
    input: ServiceOrderCreate,
    idempotencyKey: string,
  ): Promise<ServiceOrderDetail> {
    return this.api.post('/service-orders', { body: input, idempotencyKey });
  }

  setStatus(
    id: string,
    status: ServiceOrderStatus,
  ): Promise<ServiceOrderDetail> {
    return this.api.patch(`/service-orders/${id}`, { body: { status } });
  }

  addItem(
    id: string,
    input: ServiceOrderItemCreate,
    idempotencyKey: string,
  ): Promise<ServiceOrderItem> {
    return this.api.post(`/service-orders/${id}/items`, {
      body: input,
      idempotencyKey,
    });
  }

  removeItem(id: string, itemId: string): Promise<void> {
    return this.api.delete(`/service-orders/${id}/items/${itemId}`);
  }

  // RF-13: só o resumo pontual. O fluxo contínuo vai por MQTT, nunca por aqui.
  postTelemetry(
    id: string,
    snapshot: TelemetrySnapshotCreate,
  ): Promise<TelemetrySnapshot> {
    return this.api.post(`/service-orders/${id}/telemetry`, {
      body: snapshot,
    });
  }
}
