import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// RF-15/RNF-08: o LARCC nunca recebe a placa. O hash é HMAC-SHA256 do ID
// INTERNO do veículo (não da placa) com chave só do AutoOS, truncado a 32 hex
// (mesmo tamanho do exemplo do contrato).
//
// Limite conhecido: a chave vai no bundle do app (EXPO_PUBLIC_*), então quem
// extrair o APK consegue calcular hashes. Protege contra o LARCC, não contra
// um atacante com o APK — ver docs/PHASES.md, Fase 11.
export function vehicleHash(vehicleId: string, key: string): string {
  const digest = hmac(sha256, utf8ToBytes(key), utf8ToBytes(vehicleId));
  return bytesToHex(digest).slice(0, 32);
}
