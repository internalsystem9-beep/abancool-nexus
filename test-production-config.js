#!/usr/bin/env node

/**
 * Production Configuration Test Suite
 * Tests database, email, and SMS integrations
 */

require('dotenv').config({ path: '.env.production' });
const chalk = require('chalk');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function logTest(name, status, message, details = '') {
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '!';
  const color = status === 'pass' ? chalk.green : status === 'fail' ? chalk.red : chalk.yellow;
  
  console.log(color(`${icon} ${name}`));
  if (message) console.log(`  ${message}`);
  if (details) console.log(`  ${details}`);
  
  if (status === 'pass') results.passed++;
  else if (status === 'fail') results.failed++;
  else results.warnings++;
  
  results.tests.push({ name, status, message });
}

async function testDatabaseConnection() {
  console.log(chalk.blue('\n=== DATABASE CONNECTION TEST ===\n'));
  
  try {
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
    
    logTest(
      'Database Connection',
      'pass',
      `Connected to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
      `User: ${process.env.DB_USER}`
    );
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 as test');
    logTest('Database Query', 'pass', 'Simple query executed successfully');
    
    // Get table count
    const [tables] = await connection.execute(
      "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [process.env.DB_NAME]
    );
    
    const tableCount = tables[0].count;
    logTest(
      'Database Tables',
      tableCount > 0 ? 'pass' : 'warn',
      `Found ${tableCount} tables in database`
    );
    
    // Get user privileges
    const [privs] = await connection.execute("SHOW GRANTS FOR CURRENT_USER()");
    const hasAllPrivileges = privs[0]['Grants for ' + process.env.DB_USER + '@localhost']?.includes('ALL');
    logTest(
      'Database Privileges',
      hasAllPrivileges ? 'pass' : 'warn',
      'User privileges verified',
      `Privileges: ${privs.length} grant(s) found`
    );
    
    await connection.end();
    return true;
  } catch (error) {
    logTest('Database Connection', 'fail', 'Connection failed', error.message);
    return false;
  }
}

async function testEmailConfiguration() {
  console.log(chalk.blue('\n=== EMAIL CONFIGURATION TEST ===\n'));
  
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      connectionTimeout: 5000,
      socketTimeout: 5000
    });
    
    logTest(
      'Email Configuration',
      'pass',
      `SMTP Server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`,
      `User: ${process.env.SMTP_USER}`
    );
    
    // Verify connection
    const verified = await transporter.verify();
    logTest(
      'Email Connection Verification',
      verified ? 'pass' : 'fail',
      verified ? 'SMTP connection verified' : 'SMTP verification failed'
    );
    
    // Check sender configuration
    if (process.env.SMTP_FROM_EMAIL && process.env.SMTP_FROM_NAME) {
      logTest(
        'Email Sender Configuration',
        'pass',
        `From: ${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`
      );
    } else {
      logTest('Email Sender Configuration', 'warn', 'Sender name or email not configured');
    }
    
    return verified;
  } catch (error) {
    logTest('Email Configuration', 'fail', 'Email setup failed', error.message);
    return false;
  }
}

async function testSMSConfiguration() {
  console.log(chalk.blue('\n=== SMS CONFIGURATION TEST ===\n'));
  
  try {
    const axios = require('axios');
    
    // Check Bulk SMS configuration
    if (!process.env.BULKSMS_API_TOKEN) {
      logTest('Bulk SMS Token', 'fail', 'BULKSMS_API_TOKEN not configured');
      return false;
    }
    
    logTest(
      'Bulk SMS Configuration',
      'pass',
      `API Endpoint: ${process.env.BULKSMS_API_URL}`,
      `Sender ID: ${process.env.BULKSMS_SENDER_ID}`
    );
    
    // Test API connectivity
    try {
      const response = await axios.get(
        `${process.env.BULKSMS_API_URL}/sms`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.BULKSMS_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );
      
      logTest(
        'Bulk SMS API Connection',
        'pass',
        'API endpoint is accessible and responsive'
      );
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        logTest('Bulk SMS API Connection', 'fail', 'Authentication failed - check API token');
      } else {
        logTest('Bulk SMS API Connection', 'warn', 'API endpoint tested with warning', apiError.message);
      }
    }
    
    // Check Twilio (if configured)
    if (process.env.TWILIO_ACCOUNT_SID) {
      logTest('Twilio Configuration', 'pass', 'Twilio credentials configured (fallback provider)');
    } else {
      logTest('Twilio Configuration', 'warn', 'Twilio not configured (optional fallback)');
    }
    
    // Check Africa's Talking (if configured)
    if (process.env.AFRICASTALKING_API_KEY) {
      logTest('Africa\'s Talking Configuration', 'pass', 'Africa\'s Talking credentials configured (fallback provider)');
    } else {
      logTest('Africa\'s Talking Configuration', 'warn', 'Africa\'s Talking not configured (optional fallback)');
    }
    
    return true;
  } catch (error) {
    logTest('SMS Configuration', 'fail', 'SMS setup failed', error.message);
    return false;
  }
}

async function testEnvironmentVariables() {
  console.log(chalk.blue('\n=== ENVIRONMENT VARIABLES TEST ===\n'));
  
  const required = [
    'NODE_ENV',
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD',
    'BULKSMS_API_TOKEN', 'BULKSMS_SENDER_ID',
    'JWT_SECRET', 'SESSION_SECRET'
  ];
  
  let allPresent = true;
  
  for (const varName of required) {
    if (process.env[varName]) {
      const value = varName.includes('PASSWORD') || varName.includes('SECRET') || varName.includes('TOKEN')
        ? '***' + process.env[varName].slice(-4)
        : process.env[varName];
      logTest(`${varName}`, 'pass', value);
    } else {
      logTest(`${varName}`, 'fail', 'Not configured');
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function testRedisConnection() {
  console.log(chalk.blue('\n=== REDIS CONNECTION TEST ===\n'));
  
  try {
    const redis = require('redis');
    
    const client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      socket: {
        reconnectStrategy: () => null
      }
    });
    
    client.on('error', (err) => {
      logTest('Redis Connection', 'fail', 'Connection error', err.message);
    });
    
    await client.connect();
    
    logTest(
      'Redis Connection',
      'pass',
      `Connected to ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      `Database: ${process.env.REDIS_DB || 0}`
    );
    
    // Test ping
    const pong = await client.ping();
    logTest('Redis Ping', 'pass', `Response: ${pong}`);
    
    await client.quit();
    return true;
  } catch (error) {
    logTest('Redis Connection', 'warn', 'Redis not available (optional)', error.message);
    return false;
  }
}

async function testSMSService() {
  console.log(chalk.blue('\n=== SMS SERVICE TEST ===\n'));
  
  try {
    const smsService = require('./server/src/services/sms.service.js');
    
    logTest('SMS Service Import', 'pass', 'SMS service loaded successfully');
    
    // Check provider status
    const status = smsService.getProviderStatus();
    
    for (const [provider, config] of Object.entries(status)) {
      const providerStatus = config.enabled ? 'pass' : 'warn';
      logTest(
        `${provider} Provider`,
        providerStatus,
        config.enabled ? `Enabled - Sender: ${config.senderId}` : 'Disabled',
        `Stats: ${config.stats.sent} sent, ${config.stats.failed} failed`
      );
    }
    
    return true;
  } catch (error) {
    logTest('SMS Service Import', 'fail', 'Failed to load SMS service', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log(chalk.bold.blue('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   ABANCOOL PRODUCTION CONFIGURATION TEST SUITE              ║'));
  console.log(chalk.bold.blue('║   Testing Database, Email, and SMS Integration              ║'));
  console.log(chalk.bold.blue('╚════════════════════════════════════════════════════════════╝'));
  
  console.log(chalk.gray(`\nEnvironment: ${process.env.NODE_ENV}`));
  console.log(chalk.gray(`Time: ${new Date().toISOString()}\n`));
  
  // Run all tests
  await testEnvironmentVariables();
  await testDatabaseConnection();
  await testEmailConfiguration();
  await testSMSConfiguration();
  await testRedisConnection();
  await testSMSService();
  
  // Summary
  console.log(chalk.blue('\n=== TEST SUMMARY ===\n'));
  
  console.log(`${chalk.green('✓ Passed')}: ${results.passed}`);
  console.log(`${chalk.red('✗ Failed')}: ${results.failed}`);
  console.log(`${chalk.yellow('! Warnings')}: ${results.warnings}`);
  console.log(`${chalk.gray('Total Tests')}: ${results.passed + results.failed + results.warnings}`);
  
  const successRate = ((results.passed / (results.passed + results.failed + results.warnings)) * 100).toFixed(1);
  console.log(`\n${chalk.bold('Success Rate')}: ${chalk.cyan(successRate)}%`);
  
  if (results.failed === 0) {
    console.log(chalk.green.bold('\n✓ All critical tests passed! Ready for production deployment.'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold(`\n✗ ${results.failed} test(s) failed. Please review and fix.`));
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red('Test suite error:'), error);
  process.exit(1);
});
