/**
 * Production Monitoring and Alerting Configuration
 * Comprehensive monitoring setup for production environment
 */

module.exports = {
  // Monitoring Service Configuration
  monitoring: {
    // Enable monitoring
    enabled: true,

    // Monitoring interval (in seconds)
    interval: 60,

    // Data retention (in days)
    retention: 30,

    // Services to monitor
    services: {
      api: {
        enabled: true,
        port: 4000,
        healthCheckInterval: 30, // seconds
        healthCheckTimeout: 10 // seconds
      },
      database: {
        enabled: true,
        checkInterval: 60,
        timeout: 30
      },
      redis: {
        enabled: true,
        checkInterval: 60,
        timeout: 30
      },
      nginx: {
        enabled: true,
        checkInterval: 60,
        statusUrl: 'http://localhost/nginx_status'
      }
    }
  },

  // Alerting Configuration
  alerting: {
    // Enable alerting
    enabled: true,

    // Alert channels
    channels: {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        provider: 'smtp',
        recipients: process.env.ALERT_EMAIL_RECIPIENTS ? process.env.ALERT_EMAIL_RECIPIENTS.split(',') : [],
        fromAddress: process.env.ALERT_FROM_EMAIL || 'alerts@abancool.com',
        templates: {
          critical: 'critical-alert',
          warning: 'warning-alert',
          info: 'info-alert'
        }
      },
      slack: {
        enabled: process.env.ALERT_SLACK_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts',
        mentions: {
          critical: '@channel',
          warning: '@devops',
          info: ''
        }
      },
      pagerduty: {
        enabled: process.env.PAGERDUTY_ENABLED === 'true',
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
        severity: {
          critical: 'critical',
          warning: 'warning',
          info: 'info'
        }
      },
      sms: {
        enabled: process.env.ALERT_SMS_ENABLED === 'true',
        provider: process.env.SMS_PROVIDER || 'twilio',
        recipients: process.env.ALERT_SMS_RECIPIENTS ? process.env.ALERT_SMS_RECIPIENTS.split(',') : []
      }
    }
  },

  // Metrics and Thresholds
  metrics: {
    // API Metrics
    api: {
      responseTime: {
        warning: 500, // ms
        critical: 1000 // ms
      },
      errorRate: {
        warning: 1, // percentage
        critical: 5 // percentage
      },
      requestsPerSecond: {
        warning: 1000,
        critical: 2000
      },
      uptimeTarget: 99.9 // percentage
    },

    // Database Metrics
    database: {
      connectionPoolUsage: {
        warning: 80, // percentage
        critical: 95 // percentage
      },
      queryTime: {
        warning: 200, // ms
        critical: 500 // ms
      },
      slowQueryThreshold: 1000, // ms
      replicationLag: {
        warning: 10, // seconds
        critical: 60 // seconds
      }
    },

    // Redis Metrics
    redis: {
      memoryUsage: {
        warning: 80, // percentage
        critical: 95 // percentage
      },
      evictionRate: {
        warning: 1, // evictions per second
        critical: 10 // evictions per second
      },
      keyspaceHits: {
        warning: 80, // percentage (below is bad)
        critical: 60 // percentage (below is critical)
      }
    },

    // System Metrics
    system: {
      cpuUsage: {
        warning: 75, // percentage
        critical: 90 // percentage
      },
      memoryUsage: {
        warning: 80, // percentage
        critical: 95 // percentage
      },
      diskUsage: {
        warning: 80, // percentage
        critical: 95 // percentage
      },
      diskIOWait: {
        warning: 30, // percentage
        critical: 50 // percentage
      },
      networkBandwidth: {
        warning: 80, // percentage
        critical: 95 // percentage
      }
    },

    // Process Metrics
    process: {
      nodeProcessCount: {
        warning: 3,
        critical: 1 // fewer than 1 is critical
      },
      npmProcesses: {
        warning: 1,
        critical: 0
      },
      nginxWorkers: {
        warning: 2,
        critical: 0
      }
    }
  },

  // Health Check Configuration
  healthChecks: {
    // Endpoint health checks
    endpoints: [
      {
        name: 'API Health',
        url: 'http://localhost:4000/api/health',
        method: 'GET',
        interval: 30, // seconds
        timeout: 10, // seconds
        retries: 3,
        expectedStatus: 200
      },
      {
        name: 'Database Connection',
        url: 'http://localhost:4000/api/health/db',
        method: 'GET',
        interval: 60,
        timeout: 10,
        retries: 2,
        expectedStatus: 200
      },
      {
        name: 'Redis Connection',
        url: 'http://localhost:4000/api/health/redis',
        method: 'GET',
        interval: 60,
        timeout: 10,
        retries: 2,
        expectedStatus: 200
      }
    ],

    // Custom health check commands
    commands: [
      {
        name: 'Check Node Process',
        command: 'pgrep -f "node.*index.js" | wc -l',
        expectedOutput: /[1-9]/
      },
      {
        name: 'Check Nginx',
        command: 'systemctl is-active nginx',
        expectedOutput: /active/
      }
    ]
  },

  // Logging Configuration
  logging: {
    enabled: true,

    // Log levels
    level: process.env.LOG_LEVEL || 'info',

    // Log transports
    transports: {
      console: {
        enabled: true,
        level: 'info'
      },
      file: {
        enabled: true,
        directory: process.env.LOG_DIR || '/var/log/abancool',
        filename: 'app.log',
        maxSize: '10m',
        maxFiles: 30,
        level: 'debug'
      },
      errorFile: {
        enabled: true,
        directory: process.env.LOG_DIR || '/var/log/abancool',
        filename: 'error.log',
        maxSize: '10m',
        maxFiles: 30,
        level: 'error'
      },
      syslog: {
        enabled: false,
        host: 'localhost',
        port: 514,
        facility: 'local0'
      }
    }
  },

  // Alerting Rules
  alertRules: [
    {
      name: 'High Response Time',
      condition: 'api.responseTime > 1000',
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      description: 'API response time exceeded 1 second'
    },
    {
      name: 'High Error Rate',
      condition: 'api.errorRate > 5',
      severity: 'critical',
      channels: ['email', 'slack', 'sms'],
      description: 'API error rate exceeded 5%'
    },
    {
      name: 'Database Connection Pool Exhausted',
      condition: 'database.connectionPoolUsage > 95',
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      description: 'Database connection pool usage critical'
    },
    {
      name: 'High Memory Usage',
      condition: 'system.memoryUsage > 90',
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      description: 'System memory usage critical'
    },
    {
      name: 'Disk Space Low',
      condition: 'system.diskUsage > 95',
      severity: 'critical',
      channels: ['email', 'slack', 'sms'],
      description: 'Disk usage critical - may affect operations'
    },
    {
      name: 'API Down',
      condition: 'api.health === false',
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty', 'sms'],
      description: 'API health check failed'
    },
    {
      name: 'Database Down',
      condition: 'database.health === false',
      severity: 'critical',
      channels: ['email', 'slack', 'pagerduty'],
      description: 'Database is unreachable'
    },
    {
      name: 'Redis Down',
      condition: 'redis.health === false',
      severity: 'warning',
      channels: ['email', 'slack'],
      description: 'Redis connection lost'
    },
    {
      name: 'High CPU Usage',
      condition: 'system.cpuUsage > 90',
      severity: 'critical',
      channels: ['email', 'slack'],
      description: 'CPU usage is critically high'
    },
    {
      name: 'Low Cache Hit Rate',
      condition: 'redis.keyspaceHits < 60',
      severity: 'warning',
      channels: ['email'],
      description: 'Cache hit rate is below threshold'
    }
  ],

  // Uptime Monitoring
  uptime: {
    enabled: true,

    // Track uptime for SLA
    targets: {
      api: 99.9, // percentage
      database: 99.95, // percentage
      overall: 99.9 // percentage
    },

    // Downtime tracking
    trackDowntime: true,
    downtimeAlerts: true,

    // Incident tracking
    trackIncidents: true,
    incidentChannels: ['email', 'slack', 'pagerduty']
  },

  // Performance Monitoring
  performance: {
    enabled: true,

    // Profile collection interval
    profileInterval: 300, // seconds (5 minutes)

    // Slow transaction logging
    slowTransactionThreshold: 5000, // ms

    // Database query profiling
    enableQueryProfiling: true,
    slowQueryThreshold: 1000 // ms
  },

  // Security Monitoring
  security: {
    enabled: true,

    // Track failed login attempts
    trackFailedLogins: true,
    failedLoginThreshold: 10,

    // Track permission violations
    trackPermissionDenials: true,

    // Monitor for suspicious patterns
    enableAnomalyDetection: true,

    // Rate limit violations
    trackRateLimitViolations: true
  },

  // Integration with Monitoring Services
  integrations: {
    // Sentry error tracking
    sentry: {
      enabled: process.env.SENTRY_DSN ? true : false,
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      integrations: ['Http', 'OnUncaughtException', 'OnUnhandledRejection']
    },

    // DataDog APM
    datadog: {
      enabled: process.env.DATADOG_ENABLED === 'true',
      apiKey: process.env.DATADOG_API_KEY,
      appName: 'abancool-api',
      service: 'api',
      version: process.env.APP_VERSION
    },

    // New Relic
    newrelic: {
      enabled: process.env.NEW_RELIC_LICENSE_KEY ? true : false,
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      appName: 'ABANCOOL API'
    },

    // Grafana
    grafana: {
      enabled: process.env.GRAFANA_ENABLED === 'true',
      url: process.env.GRAFANA_URL,
      apiKey: process.env.GRAFANA_API_KEY
    },

    // Prometheus
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: 9090,
      metricsPath: '/metrics'
    }
  },

  // Dashboard Configuration
  dashboards: {
    // Main dashboard
    main: {
      name: 'ABANCOOL API - Main Dashboard',
      refreshInterval: 30, // seconds
      panels: [
        {
          title: 'API Health',
          type: 'gauge',
          metric: 'api.health'
        },
        {
          title: 'Response Time (avg)',
          type: 'graph',
          metric: 'api.responseTime',
          aggregation: 'avg'
        },
        {
          title: 'Error Rate',
          type: 'graph',
          metric: 'api.errorRate'
        },
        {
          title: 'System CPU',
          type: 'gauge',
          metric: 'system.cpuUsage'
        },
        {
          title: 'System Memory',
          type: 'gauge',
          metric: 'system.memoryUsage'
        }
      ]
    }
  }
};
