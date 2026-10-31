// Windows: o ninja do CMake 3.22.1 (padrão do AGP) é o 1.10, que não aceita
// caminhos acima de 260 caracteres mesmo com LongPathsEnabled — e o build
// nativo do React Native (codegen) passa disso em qualquer pasta razoável.
// O CMake 3.31.x traz ninja 1.12, que aceita. Instale com:
//   sdkmanager "cmake;3.31.6"
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// autoos: cmake com ninja 1.12 (caminhos longos)';
const CMAKE_VERSION = '3.31.6';

module.exports = function withNewerCmake(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    const contents = cfg.modResults.contents;
    if (!contents.includes(MARKER)) {
      cfg.modResults.contents = contents.replace(
        /^android \{/m,
        `android {
    ${MARKER}
    externalNativeBuild {
        cmake {
            version "${CMAKE_VERSION}"
        }
    }`,
      );
    }
    return cfg;
  });
};
