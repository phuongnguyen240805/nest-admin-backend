import type { Config } from 'jest';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pathsToModuleNameMapper } from 'ts-jest';

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
const { compilerOptions } = nodeRequire('./tsconfig.json') as {
  compilerOptions: { paths?: Record<string, string[]> };
};

const config: Config = {
  displayName: 'ladipage-backend',
  preset: '<rootDir>/jest.preset.js',
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/apps/ladipage-backend/src', '<rootDir>/apps/ladipage-backend/test'],
  testMatch: [
    '<rootDir>/apps/ladipage-backend/src/**/*.spec.ts',
    '<rootDir>/apps/ladipage-backend/test/**/*.spec.ts',
  ],
  modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/.nx', '<rootDir>/node_modules'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/apps/ladipage-backend/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths ?? {}, {
    prefix: '<rootDir>/apps/ladipage-backend/',
  }),
};

export default config;
