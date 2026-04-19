/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@community-garden/types$':
      '<rootDir>/../packages/shared-types/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/db/migrate.ts',
    '!src/db/seed.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      branches: 60,
    },
  },
  testTimeout: 15000,
};
