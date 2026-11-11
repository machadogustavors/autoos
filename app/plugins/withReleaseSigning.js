// Build de release assinado com a chave de upload da Play Store.
// Os dados da chave NÃO ficam no git: vêm de app/upload-keystore.properties
// (storeFile, storePassword, keyAlias, keyPassword), que é gitignored. Sem esse
// arquivo o release cai na chave de debug, então o CI e o dev client não mudam.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// autoos: assinatura de release (chave de upload)';

const SIGNING_CONFIG = `        release {
            ${MARKER}
            def keystoreProps = new Properties()
            def keystoreFile = rootProject.file('../upload-keystore.properties')
            if (keystoreFile.exists()) {
                keystoreFile.withInputStream { keystoreProps.load(it) }
                storeFile new File(keystoreFile.parentFile, keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    // 1) o buildType release passa a usar a chave de upload, se ela existir.
    //    Feito antes de inserir o signingConfig, para o primeiro "release {" ser o do buildTypes.
    contents = contents.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug',
    );
    // 2) declara o signingConfig release depois do debug.
    contents = contents.replace(
      /(signingConfigs \{\s*debug \{[\s\S]*?\n        \}\n)/,
      `$1${SIGNING_CONFIG}`,
    );
    cfg.modResults.contents = contents;
    return cfg;
  });
};
