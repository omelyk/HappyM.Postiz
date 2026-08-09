module.exports = {
  displayName: 'happym-connect-frontend',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/components/happym-embed/**/*.spec.ts'],
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
