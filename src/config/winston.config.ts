import * as winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';

export const winstonConfig = {
  level: isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProd
      ? winston.format.json()
      : winston.format.printf(({ level, message, timestamp, context }) => {
          return `[${timestamp}] ${level.toUpperCase()} ${context ?? ''} ${message}`;
        }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
};
