import type { ApiClient } from '../api/client';
import { formatDate } from '../format';
import { ORDER_FILTERS, statusesFor } from '../repositories/orderFilters';
import {
  ProductRepository,
  ServiceOrderRepository,
} from '../repositories/repositories';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'key' }));

const emptyPage = { items: [], paging: { hasMore: false } };

function fakeApi() {
  return {
    get: jest.fn().mockResolvedValue(emptyPage),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}
const asApi = (api: ReturnType<typeof fakeApi>) => api as unknown as ApiClient;

describe('order filters (RF-22)', () => {
  it('"Todas" sends all four statuses — the server default would hide closed OS', () => {
    expect(statusesFor('all')).toEqual([
      'open',
      'in_progress',
      'completed',
      'cancelled',
    ]);
  });

  it('a specific filter sends only that status', () => {
    expect(statusesFor('completed')).toEqual(['completed']);
    expect(statusesFor('in_progress')).toEqual(['in_progress']);
  });

  it('offers the five filters of the SPEC, "Todas" first', () => {
    expect(ORDER_FILTERS.map((f) => f.label)).toEqual([
      'Todas',
      'Abertas',
      'Em andamento',
      'Concluídas',
      'Canceladas',
    ]);
  });
});

describe('ServiceOrderRepository.listByStatus', () => {
  it('queries listServiceOrders with repeated status, limit 20, no cursor on page 1', async () => {
    const api = fakeApi();
    await new ServiceOrderRepository(asApi(api)).listByStatus('all');

    expect(api.get).toHaveBeenCalledWith('/service-orders', {
      query: {
        status: ['open', 'in_progress', 'completed', 'cancelled'],
        after: undefined,
        limit: 20,
      },
    });
  });

  it('passes the cursor on the next page', async () => {
    const api = fakeApi();
    const result = await new ServiceOrderRepository(asApi(api)).listByStatus(
      'completed',
      'cur-1',
    );

    expect(api.get).toHaveBeenCalledWith('/service-orders', {
      query: { status: ['completed'], after: 'cur-1', limit: 20 },
    });
    expect(result.fromCache).toBe(false);
  });

  it('later pages never fall back to a stale cache: a network error surfaces', async () => {
    const api = fakeApi();
    api.get.mockRejectedValue(new Error('rede'));
    await expect(
      new ServiceOrderRepository(asApi(api)).listByStatus('all', 'cur-1'),
    ).rejects.toThrow('rede');
  });
});

describe('ProductRepository.remove (RF-21)', () => {
  it('calls DELETE /products/{id}', async () => {
    const api = fakeApi();
    await new ProductRepository(asApi(api)).remove('p1');
    expect(api.delete).toHaveBeenCalledWith('/products/p1');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date in pt-BR', () => {
    expect(formatDate('2026-10-14T13:05:00-03:00')).toMatch(
      /^\d{2}\/\d{2}\/\d{4}$/,
    );
  });

  it('never throws on a missing or invalid date', () => {
    expect(formatDate(undefined)).toBe('Data indisponível');
    expect(formatDate('ontem')).toBe('Data indisponível');
  });
});
