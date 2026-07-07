import type { Config } from 'jest'

const config: Config = {
  displayName: 'nest-core',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  modulePathIgnorePatterns: ['<rootDir>/../../dist', '<rootDir>/../../.nx'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
    '^@liora/api-types$': '<rootDir>/../../apps/ladipage-backend/libs/api-types/src/index.ts',
    '^@liora/api-types/(.*)$': '<rootDir>/../../apps/ladipage-backend/libs/api-types/src/$1',
    '^@liora/database$': '<rootDir>/../../libs/database/src/index.ts',
    '^@liora/database/(.*)$': '<rootDir>/../../libs/database/src/$1',
    '^@liora/nest-core$': '<rootDir>/src/index.ts',
    '^@liora/nest-core/(.*)$': '<rootDir>/src/$1',
    '^@liora/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@liora/shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@liora/dto$': '<rootDir>/../../libs/dto/src/index.ts',
    '^@liora/dto/(.*)$': '<rootDir>/../../libs/dto/src/$1',
    '^@liora/crm-core$': '<rootDir>/../../libs/crm-core/src/index.ts',
    '^@liora/crm-core/(.*)$': '<rootDir>/../../libs/crm-core/src/$1',
    '^@liora/supabase$': '<rootDir>/../../libs/supabase/src/index.ts',
    '^@liora/supabase/(.*)$': '<rootDir>/../../libs/supabase/src/$1',
  },
}

export default config