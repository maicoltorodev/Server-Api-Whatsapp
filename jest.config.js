/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFiles: ['dotenv/config'],
    testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/server.ts',
        '!src/config/**'
    ]
};
