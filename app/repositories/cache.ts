import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache local de leitura (RF-05/RF-09: offline com cache). Não guarda token.
const PREFIX = 'autoos.cache.';

export interface Cached<T> {
  data: T;
  // true = veio do aparelho porque a rede falhou; a tela mostra "Sem conexão".
  fromCache: boolean;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // cache é conveniência; falhar em gravar não pode quebrar a tela.
  }
}

// Rede primeiro; se falhar por motivo transitório e houver cache, devolve o cache.
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  isTransient: (error: unknown) => boolean,
): Promise<Cached<T>> {
  try {
    const data = await fetcher();
    await writeCache(key, data);
    return { data, fromCache: false };
  } catch (error) {
    if (isTransient(error)) {
      const cached = await readCache<T>(key);
      if (cached !== null) return { data: cached, fromCache: true };
    }
    throw error;
  }
}
