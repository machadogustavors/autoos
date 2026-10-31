// Espelho tipado de contract/openapi.yaml. Campo novo: primeiro o OpenAPI.

export type ServiceOrderStatus =
  'open' | 'in_progress' | 'completed' | 'cancelled';

export interface Paging {
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface Page<T> {
  items: T[];
  paging: Paging;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  user: User;
}

export interface CustomerCreate {
  name: string;
  phone?: string;
}

export interface Customer extends CustomerCreate {
  id: string;
  createdAt: string;
}

export interface VehicleCreate {
  customerId: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  referenceMileage?: number;
}

export interface Vehicle extends VehicleCreate {
  id: string;
  createdAt: string;
}

export interface ProductCreate {
  name: string;
  stockQuantity: number;
}

export interface Product extends ProductCreate {
  id: string;
  createdAt: string;
}

export interface ServiceOrderCreate {
  customerId: string;
  vehicleId: string;
  description?: string;
}

export interface ServiceOrderCard {
  id: string;
  status: ServiceOrderStatus;
  vehicleId: string;
  plate: string;
  customerName: string;
  brand?: string;
  model?: string;
  hasDtcOnLastReading?: boolean;
  createdAt?: string;
}

export type ServiceOrderItemType = 'part' | 'service';

export interface ServiceOrderItemCreate {
  type: ServiceOrderItemType;
  description: string;
  productId?: string | null;
  quantity?: number;
}

export interface ServiceOrderItem extends ServiceOrderItemCreate {
  id: string;
  createdAt: string;
}

export interface TelemetrySnapshotCreate {
  mileage: number;
  engineTemperature?: number;
  batteryVoltage?: number;
  dtcCodes?: string[];
  capturedAt: string;
}

export interface TelemetrySnapshot extends TelemetrySnapshotCreate {
  id: string;
}

export interface ServiceOrderDetail extends ServiceOrderCard {
  description?: string;
  items?: ServiceOrderItem[];
  lastTelemetry?: TelemetrySnapshot;
  completedAt?: string | null;
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
