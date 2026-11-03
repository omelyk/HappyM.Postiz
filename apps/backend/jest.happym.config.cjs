module.exports = {
  displayName: 'happym-embed',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/services/happym-embed/**/*.spec.ts',
    '<rootDir>/src/services/happym-appliance/**/*.spec.ts',
    '<rootDir>/src/public-api/**/*.spec.ts',
  ],
  transform: {
    "[/\\\\]node_modules[/\\\\](?:nostr-tools|nostr-wasm|@noble[/\\\\](?:ciphers|curves|hashes)|@scure[/\\\\](?:base|bip32|bip39))[/\\\\].+\\.[cm]?js$": '<rootDir>/jest.happym-esm-transform.cjs',
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: true,
      },
    ],
  },
  // pnpm real paths contain a second node_modules segment.
  transformIgnorePatterns: [
    "[/\\\\]node_modules[/\\\\](?!\\.pnpm[/\\\\]|(?:nostr-tools|nostr-wasm|@noble[/\\\\](?:ciphers|curves|hashes)|@scure[/\\\\](?:base|bip32|bip39))[/\\\\])",
    '\\.pnp\\.[^\\/]+$',
  ],
  moduleNameMapper: {
    '^@gitroom/backend/(.*)$': '<rootDir>/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/../../libraries/helpers/src/$1',
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/../../libraries/nestjs-libraries/src/$1',
  },
};
