import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from '../api/client';
import type { TokenPair } from '../api/types';

// RF-01: tokens só em armazenamento seguro, nunca AsyncStorage.
const KEY = 'autoos.tokens';

export const secureTokenStore: TokenStore = {
  async get(): Promise<TokenPair | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenPair;
    } catch {
      return null;
    }
  },
  async set(tokens: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
  },
};
