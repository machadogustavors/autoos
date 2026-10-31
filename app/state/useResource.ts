import { useCallback, useEffect, useRef, useState } from 'react';
import { messageFor } from '../api/errors';
import type { Cached } from '../repositories/cache';

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T; fromCache: boolean };

type Settled<T> = Exclude<ResourceState<T>, { status: 'loading' }>;

// Padrão de toda tela de lista/detalhe: loading → ready | error, com
// "tentar novamente" localizado (RNF-05) e aviso de cache (SPEC §3).
//
// `deps` identifica O QUE está sendo carregado (ex.: id, termo de busca).
// Trocou → volta a "loading". `reload` busca de novo o MESMO recurso mantendo
// o dado antigo na tela até chegar o novo (sem piscar esqueleto).
export function useResource<T>(
  load: () => Promise<Cached<T>>,
  deps: readonly unknown[],
): { state: ResourceState<T>; reload: () => void } {
  const identity = JSON.stringify(deps);
  const [settled, setSettled] = useState<{
    identity: string;
    state: Settled<T>;
  } | null>(null);
  const [tick, setTick] = useState(0);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setSettled({
          identity,
          state: {
            status: 'ready',
            data: result.data,
            fromCache: result.fromCache,
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSettled({
          identity,
          state: { status: 'error', message: messageFor(error) },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [identity, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  // Resultado de OUTRO recurso (deps mudaram) não vale: está carregando.
  const state: ResourceState<T> =
    settled !== null && settled.identity === identity
      ? settled.state
      : { status: 'loading' };
  return { state, reload };
}
