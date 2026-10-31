import type { ServiceOrderStatus } from '../api/types';

// RF-22: filtros de "Todas as OS". `listServiceOrders` recebe `status` repetido;
// sem `status` o servidor devolve só open + in_progress (pátio, RF-05), então
// "Todas" precisa mandar os quatro.
export type OrderFilter =
  'all' | 'open' | 'in_progress' | 'completed' | 'cancelled';

const ALL_STATUSES: ServiceOrderStatus[] = [
  'open',
  'in_progress',
  'completed',
  'cancelled',
];

export function statusesFor(filter: OrderFilter): ServiceOrderStatus[] {
  return filter === 'all' ? ALL_STATUSES : [filter];
}

export const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abertas' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'cancelled', label: 'Canceladas' },
];

// Vazio por filtro (SPEC RF-22): frase direta, sem tela em branco.
export const EMPTY_BY_FILTER: Record<OrderFilter, string> = {
  all: 'Nenhuma OS registrada ainda.',
  open: 'Nenhuma OS aberta.',
  in_progress: 'Nenhuma OS em andamento.',
  completed: 'Nenhuma OS concluída.',
  cancelled: 'Nenhuma OS cancelada.',
};
