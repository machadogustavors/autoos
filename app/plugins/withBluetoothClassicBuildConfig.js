// react-native-bluetooth-classic usa BuildConfig.DEBUG, mas o Android Gradle
// Plugin recente não gera BuildConfig em bibliotecas por padrão, e a lib não
// pede. Sem isto o build falha em PairingReceiver/StateChangeReceiver.
// Plugin em vez de editar node_modules: sobrevive a npm install e a prebuild.
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// autoos: bluetooth-classic BuildConfig';

module.exports = function withBluetoothClassicBuildConfig(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += `
${MARKER}
subprojects { subproject ->
  subproject.pluginManager.withPlugin('com.android.library') {
    if (subproject.name == 'react-native-bluetooth-classic') {
      subproject.android.buildFeatures.buildConfig = true
    }
  }
}
`;
    }
    return cfg;
  });
};
