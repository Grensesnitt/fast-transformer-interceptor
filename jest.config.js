module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
    "collectCoverage": true,
    "coverageReporters": ["text", "lcov"]
};