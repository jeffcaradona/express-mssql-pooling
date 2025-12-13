// src/utils/logger.js
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
