module.exports = {
  // Environment setup
  testEnvironment: 'node',
  
  // Test timeout in milliseconds
  testTimeout: 30000,
  
  // Roots to scan for test files
  roots: [
    '<rootDir>/tests'
  ],
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!src/migrations/**',
    '!src/scripts/**',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Coverage report formats
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Output directory for coverage
  coverageDirectory: '<rootDir>/coverage',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // Transform files
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Module name mapper for resolving imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Verbose output
  verbose: true,
  
  // Show test results for each suite
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathAsClassName: 'true'
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'test-report.html',
        pageTitle: 'ABANCOOL API Test Report',
        expand: true,
        openReport: false
      }
    ]
  ],
  
  // Maximum workers for parallel testing
  maxWorkers: '50%',
  
  // Bail after first test suite failure
  bail: 0,
  
  // Clear mocks between test suites
  clearMocks: true,
  
  // Restore mocks between test suites
  restoreMocks: true,
  
  // Mock globals
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },
  
  // Jest cache
  cache: true,
  cacheDirectory: '.jest-cache',
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ]
};
