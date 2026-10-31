import { useCallback, useState } from 'react';
import { messageFor } from '../api/errors';
import type { Paging, ServiceOrderCard } from '../api/types';
import type { OrderFilter } from '../repositories/orderFilters';
import { services } from './services';
import { useResource } from './useResource';

interface MorePages {
  filter: OrderFilter;
  items: ServiceOrderCard[];
  paging: Paging;
}

// RF-22: primeira página pelo useResource (loading/erro/cache iguais ao resto
// do app) + páginas seguintes anexadas ao rolar até o fim.
export function useOrderList(filter: OrderFilter) {
  const first = useResource(
    () => services.serviceOrders.listByStatus(filter),
    [filter],
  );
  const [more, setMore] = useState<MorePages | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  // Páginas extras de OUTRO filtro não valem.
  const extra = more?.filter === filter ? more : null;

  const firstData = first.state.status === 'ready' ? first.state.data : null;
  const items = firstData ? [...firstData.items, ...(extra?.items ?? [])] : [];
  const paging = extra?.paging ?? firstData?.paging ?? null;
  const hasMore = paging?.hasMore === true && !!paging.nextCursor;

  const loadMore = useCallback(async () => {
    if (loadingMore || !paging?.hasMore || !paging.nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const { data } = await services.serviceOrders.listByStatus(
        filter,
        paging.nextCursor,
      );
      setMore((prev) => {
        const kept = prev?.filter === filter ? prev.items : [];
        const known = new Set([
          ...(firstData?.items ?? []).map((o) => o.id),
          ...kept.map((o) => o.id),
        ]);
        return {
          filter,
          items: [...kept, ...data.items.filter((o) => !known.has(o.id))],
          paging: data.paging,
        };
      });
    } catch (error) {
      setMoreError(messageFor(error));
    } finally {
      setLoadingMore(false);
    }
  }, [filter, firstData, loadingMore, paging]);

  const { reload: reloadFirst } = first;
  // Recarregar volta à 1ª página: as extras ficariam velhas.
  const reload = useCallback(() => {
    setMore(null);
    setMoreError(null);
    reloadFirst();
  }, [reloadFirst]);

  return {
    state: first.state,
    items,
    hasMore,
    loadingMore,
    moreError,
    loadMore,
    reload,
  };
}
