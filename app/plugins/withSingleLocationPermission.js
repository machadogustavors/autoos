// A Play Store recusa o .aab se o manifesto mesclado tiver ACCESS_FINE_LOCATION
// declarada mais de uma vez com maxSdkVersion diferentes. O plugin do
// react-native-ble-plx já declara a permissão só até a API 30 (uses-permission-sdk-23),
// que é quando o Android a exige para buscar Bluetooth. Mas as bibliotecas
// react-native-ble-plx e react-native-bluetooth-classic trazem a mesma permissão
// sem limite no manifesto delas. Aqui removemos essa versão sem limite do merge.
const { withAndroidManifest } = require('expo/config-plugins');

const FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION';

module.exports = function withSingleLocationPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
    const permissions = manifest['uses-permission'] ?? [];
    const alreadyRemoved = permissions.some(
      (p) => p.$['android:name'] === FINE_LOCATION && p.$['tools:node'] === 'remove',
    );
    if (!alreadyRemoved) {
      permissions.push({ $: { 'android:name': FINE_LOCATION, 'tools:node': 'remove' } });
    }
    manifest['uses-permission'] = permissions;
    return cfg;
  });
};
