import type { Config } from 'jest'

const config: Config = {
  preset: './jest.preset.js',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.nx/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.nx/'],
  testMatch: [
    '<rootDir>/libs/database/src/**/*.spec.ts',
    '<rootDir>/libs/supabase/src/**/*.spec.ts',
    '<rootDir>/libs/nest-core/src/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/libs/nest-core/src/$1',
    '^@liora/database$': '<rootDir>/libs/database/src/index.ts',
    '^@liora/database/(.*)$': '<rootDir>/libs/database/src/$1',
    '^@liora/supabase$': '<rootDir>/libs/supabase/src/index.ts',
    '^@liora/supabase/(.*)$': '<rootDir>/libs/supabase/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
}

export default config