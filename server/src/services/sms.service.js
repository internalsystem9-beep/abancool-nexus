/**
 * SMS Service Module
 * Handles SMS sending through multiple providers: Bulk SMS, Twilio, Africa's Talking
 */

const axios = require('axios');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    this.providers = {
      bulksms: {
        enabled: process.env.BULKSMS_ENABLED === 'true',
        url: process.env.BULKSMS_API_URL,
        token: process.env.BULKSMS_API_TOKEN,
        senderId: process.env.BULKSMS_SENDER_ID,
        priority: 1
      },
      twilio: {
        enabled: process.env.TWILIO_ACCOUNT_SID ? true : false,
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER,
        priority: 2
      },
      africastalking: {
        enabled: process.env.AFRICASTALKING_API_KEY ? true : false,
        apiKey: process.env.AFRICASTALKING_API_KEY,
        username: process.env.AFRICASTALKING_USERNAME,
        senderId: process.env.AFRICASTALKING_SENDER_ID,
        priority: 3
      }
    };

    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      byProvider: {
        bulksms: { sent: 0, failed: 0 },
        twilio: { sent: 0, failed: 0 },
        africastalking: { sent: 0, failed: 0 }
      }
    };
  }

  /**
   * Send SMS using the best available provider
   * @param {string} phone - Phone number (with country code)
   * @param {string} message - Message content
   * @param {string} provider - Optional specific provider
   * @returns {Promise<Object>} Result with status and provider info
   */
  async send(phone, message, provider = null) {
    try {
      // Validate inputs
      if (!phone || !message) {
        throw new Error('Phone and message are required');
      }

      // Normalize phone number (remove spaces, dashes)
      const normalizedPhone = phone.replace(/[\s\-()]/g, '');

      let result;

      if (provider) {
        // Use specific provider
        result = await this.sendViaProvider(normalizedPhone, message, provider);
      } else {
        // Use best available provider by priority
        result = await this.sendViaAnyProvider(normalizedPhone, message);
      }

      if (result.success) {
        this.stats.totalSent++;
        this.stats.byProvider[result.provider].sent++;
        logger.info(`SMS sent via ${result.provider}`, {
          phone: normalizedPhone,
          provider: result.provider,
          messageId: result.messageId
        });
      } else {
        this.stats.totalFailed++;
        this.stats.byProvider[result.provider].failed++;
        logger.error(`SMS failed via ${result.provider}`, {
          phone: normalizedPhone,
          provider: result.provider,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      logger.error('SMS service error', { error: error.message });
      return {
        success: false,
        error: error.message,
        provider: 'unknown'
      };
    }
  }

  /**
   * Send SMS via specific provider
   */
  async sendViaProvider(phone, message, providerName) {
    const provider = this.providers[providerName];

    if (!provider || !provider.enabled) {
      return {
        success: false,
        error: `Provider ${providerName} not available`,
        provider: providerName
      };
    }

    switch (providerName) {
      case 'bulksms':
        return this.sendViaBulkSMS(phone, message);
      case 'twilio':
        return this.sendViaTwilio(phone, message);
      case 'africastalking':
        return this.sendViaAfricasTalking(phone, message);
      default:
        return {
          success: false,
          error: `Unknown provider: ${providerName}`,
          provider: providerName
        };
    }
  }

  /**
   * Send SMS via available providers in priority order
   */
  async sendViaAnyProvider(phone, message) {
    // Sort providers by priority (lower number = higher priority)
    const sortedProviders = Object.entries(this.providers)
      .filter(([, config]) => config.enabled)
      .sort((a, b) => a[1].priority - b[1].priority);

    if (sortedProviders.length === 0) {
      return {
        success: false,
        error: 'No SMS providers configured',
        provider: 'none'
      };
    }

    // Try each provider in priority order
    for (const [providerName] of sortedProviders) {
      try {
        const result = await this.sendViaProvider(phone, message, providerName);
        if (result.success) {
          return result;
        }
      } catch (error) {
        logger.warn(`Failed to send via ${providerName}, trying next...`, {
          error: error.message
        });
      }
    }

    return {
      success: false,
      error: 'All SMS providers failed',
      provider: 'all_failed'
    };
  }

  /**
   * Send via Bulk SMS (TalkSasa)
   */
  async sendViaBulkSMS(phone, message) {
    try {
      const config = this.providers.bulksms;

      const payload = {
        recipient: phone,
        sender_id: config.senderId,
        type: process.env.BULKSMS_MESSAGE_TYPE || 'plain',
        message: message
      };

      const response = await axios.post(
        `${config.url}/sms/send`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          provider: 'bulksms',
          messageId: response.data.data?.uid || response.data.data?.id || 'unknown',
          response: response.data
        };
      } else {
        return {
          success: false,
          provider: 'bulksms',
          error: response.data.message || 'Unknown error',
          response: response.data
        };
      }
    } catch (error) {
      return {
        success: false,
        provider: 'bulksms',
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Send via Twilio
   */
  async sendViaTwilio(phone, message) {
    try {
      const config = this.providers.twilio;
      const twilio = require('twilio');
      const client = twilio(config.accountSid, config.authToken);

      const result = await client.messages.create({
        body: message,
        from: config.phoneNumber,
        to: phone
      });

      return {
        success: true,
        provider: 'twilio',
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      return {
        success: false,
        provider: 'twilio',
        error: error.message
      };
    }
  }

  /**
   * Send via Africa's Talking
   */
  async sendViaAfricasTalking(phone, message) {
    try {
      const config = this.providers.africastalking;
      const AfricasTalking = require('africastalking');

      const at = AfricasTalking({
        apiKey: config.apiKey,
        username: config.username
      });

      const result = await at.SMS.send({
        to: phone,
        message: message,
        from: config.senderId
      });

      if (result.SMSMessageData?.Recipients?.length > 0) {
        const recipient = result.SMSMessageData.Recipients[0];
        return {
          success: recipient.statusCode === 101,
          provider: 'africastalking',
          messageId: recipient.messageId,
          cost: recipient.messageParts,
          status: recipient.status
        };
      }

      return {
        success: false,
        provider: 'africastalking',
        error: 'No recipients in response'
      };
    } catch (error) {
      return {
        success: false,
        provider: 'africastalking',
        error: error.message
      };
    }
  }

  /**
   * Send SMS campaign to multiple recipients
   */
  async sendCampaign(recipients, message, providerName = 'bulksms') {
    try {
      const results = [];

      for (const phone of recipients) {
        const result = await this.send(phone, message, providerName);
        results.push({
          phone,
          ...result
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Campaign sent', {
        total: results.length,
        success: successCount,
        failed: failureCount
      });

      return {
        success: successCount > 0,
        total: results.length,
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      logger.error('Campaign error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get SMS statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalSent / (this.stats.totalSent + this.stats.totalFailed) || 0
    };
  }

  /**
   * Check provider status
   */
  getProviderStatus() {
    return Object.entries(this.providers).reduce((acc, [name, config]) => {
      acc[name] = {
        enabled: config.enabled,
        senderId: config.senderId || config.phoneNumber || 'N/A',
        stats: this.stats.byProvider[name]
      };
      return acc;
    }, {});
  }

  /**
   * Send OTP SMS
   */
  async sendOTP(phone, otp, expiryMinutes = 10) {
    const message = `Your ABANCOOL verification code is: ${otp}. This code will expire in ${expiryMinutes} minutes.`;
    return this.send(phone, message);
  }

  /**
   * Send transaction alert SMS
   */
  async sendTransactionAlert(phone, amount, type = 'debit') {
    const message = type === 'debit'
      ? `Your ABANCOOL account has been debited KES ${amount}. Visit your dashboard for details.`
      : `Your ABANCOOL account has been credited KES ${amount}. Thank you!`;
    return this.send(phone, message);
  }

  /**
   * Send notification SMS
   */
  async sendNotification(phone, title, message) {
    const fullMessage = `${title}: ${message}`;
    return this.send(phone, fullMessage);
  }
}

module.exports = new SMSService();
