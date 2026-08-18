module.exports = {
  displayName: 'happym-connect-frontend',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/components/happym-embed/**/*.spec.ts',
    '<rootDir>/src/components/happym-appliance/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: true,
      },
    ],
  },
};
