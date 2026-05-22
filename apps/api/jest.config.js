/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // Resolve the workspace shared package to its TS source for tests.
    '^@3pl/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@3pl/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    // Strip ESM-style .js extensions from relative imports (shared source uses them).
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // ts-jest must transform the shared package source (it lives outside node_modules).
  transformIgnorePatterns: ['/node_modules/(?!@3pl/)'],
  clearMocks: true,
};
