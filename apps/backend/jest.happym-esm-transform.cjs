// Only the locked Nostr JavaScript dependency closure is routed here by Jest.
// Keep the real provider graph; no mocks, alias substitution or package edits.
const { transformSync } = require('@swc/core');

module.exports = {
  process(sourceText, sourcePath) {
    const output = transformSync(sourceText, {
      filename: sourcePath,
      swcrc: false,
      configFile: false,
      sourceMaps: true,
      jsc: {
        parser: { syntax: 'ecmascript' },
        target: 'es2022',
        externalHelpers: false,
      },
      module: { type: 'commonjs' },
    });
    return { code: output.code, map: output.map };
  },
};
