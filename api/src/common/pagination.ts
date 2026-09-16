// Paginação por cursor (RNF-10): `after` + `limit` (default 20, máx 50).
// Nunca offset — usado em listCustomers, listVehicles, listProducts,
// listServiceOrders, listVehicleServiceOrders.

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export interface Paging {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Paged<T> {
  items: T[];
  paging: Paging;
}

export function resolveLimit(limit?: number): number {
  if (!limit || limit <= 0) {
    return DEFAULT_PAGE_LIMIT;
  }
  return Math.min(limit, MAX_PAGE_LIMIT);
}

// Busque `limit + 1` linhas (ordenadas de forma estável) e passe o
// resultado aqui — decide hasMore/nextCursor sem uma segunda query de count.
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
): Paged<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, paging: { nextCursor, hasMore } };
}
