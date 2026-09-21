/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  modulePaths: ['node_modules', '<rootDir>'],
  // `npm run build` emits declarations for the test files into dist/, and those
  // .test.d.ts files match the default testMatch. Without this, running the
  // suite after a build reports phantom failures for every emitted declaration.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/']
};
