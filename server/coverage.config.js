/**
 * Coverage Analysis and Reporting Configuration
 * Code coverage thresholds, quality gates, and reporting
 */

module.exports = {
  // Coverage thresholds for CI/CD gates
  thresholds: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  },

  // Coverage thresholds by file/directory
  thresholdsByModule: {
    'src/controllers/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    'src/middleware/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/utils/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    'src/services/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Coverage report formats
  reportFormats: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'cobertura',
    'teamcity'
  ],

  // Coverage report directories
  reportDirs: {
    html: './coverage/html',
    lcov: './coverage',
    json: './coverage/coverage.json'
  },

  // Excluded files and patterns from coverage
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.js',
    '**/*.spec.js',
    '**/tests/**',
    '**/.git/**',
    '**/.vscode/**'
  ],

  // Quality gates
  qualityGates: {
    // Fail if coverage drops below this percentage
    minCoveragePercentage: 70,

    // Fail if there are more than this many uncovered lines
    maxUncoveredLines: 500,

    // Fail if there are more than this many uncovered branches
    maxUncoveredBranches: 200,

    // Fail if code duplication is above this percentage
    maxDuplication: 3,

    // Fail if technical debt is above this percentage
    maxTechnicalDebt: 5
  },

  // Metrics collection
  metrics: {
    // Calculate cyclomatic complexity
    calculateComplexity: true,

    // Calculate maintainability index
    calculateMaintainability: true,

    // Calculate code smells
    detectCodeSmells: true,

    // Calculate duplicate code percentage
    calculateDuplication: true
  },

  // Trends and historical data
  trends: {
    // Track coverage over time
    trackTrends: true,
    trendHistoryDays: 30,

    // Alert on coverage regression
    alertOnRegression: true,
    regressionThreshold: 2, // percentage points
  },

  // Report generation
  reports: {
    // Generate detailed HTML report
    generateHtmlReport: true,

    // Generate PDF report
    generatePdfReport: false,

    // Generate dashboard
    generateDashboard: true,

    // Send email notifications
    emailNotifications: false,
    emailRecipients: ['dev-team@abancool.com']
  },

  // Custom assertions and checks
  customChecks: {
    // Ensure critical functions have tests
    criticalFunctions: [
      'authenticate',
      'authorize',
      'validateInput',
      'encryptData',
      'decryptData',
      'processPayment'
    ],

    // Ensure critical files have minimum coverage
    criticalFiles: [
      'src/middleware/auth.js',
      'src/middleware/rbac.js',
      'src/utils/security.js',
      'src/utils/encryption.js'
    ],

    // Minimum coverage for critical files
    criticalFileCoverage: 90
  }
};
