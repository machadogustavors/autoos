import { ApiClient } from '../api/client';
import { config } from '../config';
import {
  AuthRepository,
  CustomerRepository,
  ProductRepository,
  ServiceOrderRepository,
  VehicleRepository,
} from '../repositories/repositories';
import { secureTokenStore } from '../repositories/tokenStore';

type SessionExpiredListener = () => void;

let sessionExpiredListener: SessionExpiredListener = () => undefined;

// O SessionProvider se registra aqui: o ApiClient nasce antes do React.
export function onSessionExpired(listener: SessionExpiredListener): void {
  sessionExpiredListener = listener;
}

const api = new ApiClient({
  baseUrl: config.apiUrl,
  tokens: secureTokenStore,
  onSessionExpired: () => sessionExpiredListener(),
});

// A tela nunca chama fetch, BLE ou MQTT direto — só estes repositórios (SPEC §6.3).
export const services = {
  auth: new AuthRepository(api, secureTokenStore),
  customers: new CustomerRepository(api),
  vehicles: new VehicleRepository(api),
  products: new ProductRepository(api),
  serviceOrders: new ServiceOrderRepository(api),
};
