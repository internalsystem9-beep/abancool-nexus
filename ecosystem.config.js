module.exports = {
  apps: [
    {
      // Application name
      name: 'abancool-api',
      
      // Script to execute
      script: './server/src/index.js',
      
      // Watch files for changes (auto-restart)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'coverage'],
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 4000
      },
      
      // Production environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      
      // Instance management
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Cluster mode for load balancing
      
      // Memory restart threshold
      max_memory_restart: '512M',
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      output: './logs/pm2/out.log',
      error: './logs/pm2/error.log',
      
      // Auto restart on file changes
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Arguments
      args: '',
      node_args: '--max-old-space-size=4096',
      
      // Merge logs from multiple instances
      merge_logs: true,
      
      // Cron auto restart (e.g., daily at 2 AM)
      cron_restart: '0 2 * * *',
      
      // Run as specific user (Linux only)
      // uid: 'www-data',
      // gid: 'www-data',
      
      // Custom environment file
      env_file: '.env.production',
      
      // Interpreter override
      interpreter: 'node',
      interpreter_args: '',
      
      // Max request timeout
      max_request_timeout: 30000,
    }
  ],
  
  // Deploy configuration
  deploy: {
    production: {
      // SSH connection
      user: 'deploy',
      host: 'api.abancool.com',
      key: '~/.ssh/deploy_key',
      port: 22,
      
      // Remote directory
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/abancool-nexus.git',
      path: '/var/www/abancool',
      'post-deploy': 'npm ci --production && npm run migrate && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production"',
      
      // Pre-release tasks
      'pre-release': 'npm run test && npm run build',
    },
    staging: {
      user: 'deploy',
      host: 'staging-api.abancool.com',
      key: '~/.ssh/deploy_key',
      port: 22,
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/abancool-nexus.git',
      path: '/var/www/abancool-staging',
      'post-deploy': 'npm ci && npm run migrate:staging && pm2 reload ecosystem.config.js --env staging',
    }
  }
};
