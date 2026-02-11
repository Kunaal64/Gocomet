/**
 * New Relic Agent Configuration
 * 
 * This file configures the New Relic APM agent for monitoring
 * API performance, database queries, and response times.
 * 
 * Replace YOUR_NEW_RELIC_LICENSE_KEY with your actual license key.
 * Sign up at https://newrelic.com for 100GB free tier.
 */

'use strict';

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Gaming-Leaderboard'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || 'YOUR_NEW_RELIC_LICENSE_KEY',
  distributed_tracing: {
    enabled: true,
  },
  logging: {
    level: 'info',
    filepath: 'stdout',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },
  transaction_tracer: {
    enabled: true,
    record_sql: 'obfuscated',
    explain_threshold: 500, // ms
  },
  slow_sql: {
    enabled: true,
    max_samples: 10,
  },
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
  },
};
