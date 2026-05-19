const axios = require('axios');
const https = require('https');
const logger = require('../../middleware/logger');

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 30000;

class WHMClient {
  constructor() {
    if (!process.env.WHM_HOST || !process.env.WHM_USERNAME || !process.env.WHM_TOKEN) {
      throw new Error('WHM credentials not configured: WHM_HOST, WHM_USERNAME, WHM_TOKEN required');
    }

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: REQUEST_TIMEOUT,
      freeSocketTimeout: 30000,
    });

    this.client = axios.create({
      baseURL: process.env.WHM_HOST,
      httpsAgent,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Authorization': `whm ${process.env.WHM_USERNAME}:${process.env.WHM_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'ABANCOOL-Command-Center/1.0',
      },
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        logger.debug(`[WHM Request] ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        logger.error('[WHM Request Error]', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug(`[WHM Response] ${response.config.url} - ${response.status} (${duration}ms)`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error('[WHM Response Error]', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config.url,
          });
        } else if (error.request) {
          logger.error('[WHM Request Error - No Response]', {
            message: error.message,
            url: error.config?.url,
          });
        } else {
          logger.error('[WHM Error]', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async retryRequest(fn, attempts = RETRY_ATTEMPTS) {
    let lastError;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || i === attempts - 1) {
          throw error;
        }

        const delay = RETRY_DELAY * Math.pow(2, i);
        logger.warn(`[WHM Retry] Attempt ${i + 1} failed, retrying in ${delay}ms`, {
          error: error.message,
          url: error.config?.url,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  isRetryableError(error) {
    if (!error.response) return true;

    const status = error.response.status;
    return (
      status === 408 ||
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    );
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async get(endpoint, params = {}) {
    return this.retryRequest(() =>
      this.client.get(endpoint, { params })
    );
  }

  async post(endpoint, data = {}) {
    return this.retryRequest(() =>
      this.client.post(endpoint, new URLSearchParams(data).toString())
    );
  }

  async parseResponse(response) {
    const data = response.data;

    if (data.status === 0 || data.statusmsg === 'Error') {
      const errorMessage = data.errors?.[0] || data.statusmsg || 'Unknown WHM API error';
      const error = new Error(errorMessage);
      error.code = 'WHM_API_ERROR';
      error.details = data;
      throw error;
    }

    return data;
  }

  buildQueryParams(params) {
    const filtered = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') {
        filtered[key] = value;
      }
    }
    return filtered;
  }
}

module.exports = new WHMClient();
