import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, isApiError } from '../api/errors';
import { fetchWithCache } from '../repositories/cache';
import { draftStore } from '../repositories/draftStore';

const transient = (e: unknown) => isApiError(e) && e.isTransient;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('fetchWithCache (RF-05/RF-09 offline com cache)', () => {
  it('online: returns fresh data and refreshes the cache', async () => {
    const result = await fetchWithCache(
      'yard',
      async () => ['os-1'],
      transient,
    );
    expect(result).toEqual({ data: ['os-1'], fromCache: false });
  });

  it('network down: serves the last good response, flagged as cache', async () => {
    await fetchWithCache('yard', async () => ['os-1'], transient);
    const result = await fetchWithCache(
      'yard',
      async () => {
        throw new ApiError(0, 'NETWORK', 'Sem conexão.');
      },
      transient,
    );
    expect(result).toEqual({ data: ['os-1'], fromCache: true });
  });

  it('network down with nothing cached: the error surfaces (section error, not blank)', async () => {
    await expect(
      fetchWithCache(
        'never-visited',
        async () => {
          throw new ApiError(0, 'NETWORK', 'Sem conexão.');
        },
        transient,
      ),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('a 404 is NOT masked by cache (the OS is gone)', async () => {
    await fetchWithCache('os.1', async () => ({ id: '1' }), transient);
    await expect(
      fetchWithCache(
        'os.1',
        async () => {
          throw new ApiError(404, 'NOT_FOUND', 'x');
        },
        transient,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('cache is per key', async () => {
    await fetchWithCache('yard', async () => ['a'], transient);
    await expect(
      fetchWithCache(
        'other',
        async () => {
          throw new ApiError(0, 'NETWORK', 'x');
        },
        transient,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('draftStore (RF-08)', () => {
  const draft = {
    customer: null,
    vehicle: null,
    description: 'barulho na suspensão',
    idempotencyKey: '3f1c9a52-0000-4000-8000-000000000001',
  };

  it('survives a reload with the same idempotency key', async () => {
    await draftStore.save(draft);
    expect(await draftStore.load()).toEqual(draft);
  });

  it('is gone after clear (OS created)', async () => {
    await draftStore.save(draft);
    await draftStore.clear();
    expect(await draftStore.load()).toBeNull();
  });
});
