/* eslint-disable */
const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  displayName: 'crm-core',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@liora/nest-core/helper/paginate$': '<rootDir>/src/__mocks__/nest-core-paginate.ts',
    '^@liora/nest-core$': '<rootDir>/src/__mocks__/nest-core.ts',
    '^@liora/nest-core/(.*)$': '<rootDir>/src/__mocks__/nest-core.ts',
  },
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/crm-core',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};