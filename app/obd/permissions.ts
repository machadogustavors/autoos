import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { ObdError } from './types';

// RF-12: permissão negada → a tela explica e leva à configuração do sistema.
// Android 12+ (API 31): BLUETOOTH_SCAN/CONNECT. Antes: localização.
export async function ensureBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const sdk = typeof Platform.Version === 'number' ? Platform.Version : 0;
  const wanted =
    sdk >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(wanted);
  const denied = wanted.some(
    (permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied) {
    throw new ObdError('PERMISSION_DENIED', 'Permissão de Bluetooth negada.');
  }
}

export function openSystemSettings(): void {
  void Linking.openSettings();
}
