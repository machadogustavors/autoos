import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer, Vehicle } from '../api/types';

// RF-08: rascunho da Nova OS sobrevive a queda de rede e a fechar o app.
const KEY = 'autoos.draft.new-service-order';

export interface NewServiceOrderDraft {
  customer: Customer | null;
  vehicle: Vehicle | null;
  description: string;
  // Reenviar a MESMA chave devolve o mesmo recurso (RNF-06). Se o conteúdo
  // muda, a chave muda — senão o servidor devolveria a OS antiga.
  idempotencyKey: string;
}

export const draftStore = {
  async load(): Promise<NewServiceOrderDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as NewServiceOrderDraft) : null;
    } catch {
      return null;
    }
  },
  async save(draft: NewServiceOrderDraft): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // sem espaço/IO: a tela segue com o estado em memória.
    }
  },
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // idem
    }
  },
};
