/**
 * Winston logger configuration module
 * Provides centralized logging for the application
 * 
 * Development: Colorized console output with debug level
 * Production: JSON formatted logs to console and file with info level
 * 
 * @module utils/logger
 * @example
 * import logger from './utils/logger.js';
 * 
 * logger.info('Server started');
 * logger.error('Database connection failed', { error: err });
 * logger.debug('Processing request', { userId: 123 });
 */
import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';

// Ensure logs directory exists
const logDir = path.resolve('logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
  transports: [
    new winston.transports.Console(),
    ...(isProduction ? [
      new winston.transports.File({ filename: path.join(logDir, 'app.log') })
    ] : [])
  ]
});


export default logger;
