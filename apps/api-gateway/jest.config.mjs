// Gateway APP tests (REQ-TEST-04): Jest + Supertest over a real INestApplication. ESM, so jest runs with --experimental-vm-modules (see the test:dynamic script).
export default {
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Source files import './x.js'; jest resolves the .ts file behind it.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testTimeout: 15000,
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json', diagnostics: false }] },
};
