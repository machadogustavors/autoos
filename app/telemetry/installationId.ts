import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'autoos.installation-id';

// Identifica esta instalação no client ID do MQTT (autoos-app-<installationId>).
// Não é dado pessoal nem do veículo.
export async function getInstallationId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = Crypto.randomUUID();
    await AsyncStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return Crypto.randomUUID();
  }
}
