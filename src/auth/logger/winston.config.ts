import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getHostname } from './hostname.util';
import { getIPAdress } from './hostinfo.util';

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL;

const errorRotateTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  level: 'error',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '72h',
});

const combinedRotateTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  level: logLevel,
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '72h',
});

export const winstonConfig = {
  level: logLevel,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },

  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),

    winston.format((info) => {
      info.hostname = getHostname();
      info.ip = getIPAdress();
      info.environment = process.env.NODE_ENV || 'development';
      return info;
    })(),

    ...(isProd
      ? [winston.format.json()]
      : [
          winston.format.colorize({ all: true }),
          winston.format.printf(
            ({ timestamp, level, message, ip, hostname, context }) => {
              return `[${String(timestamp)}] [${typeof context === 'string' ? context : 'App'}] [${String(hostname)}] [${String(ip)}]${String(level)}: ${String(message)}`;
            },
          ),
        ]),
  ),

  transports: [
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info',
    }),

    ...(isProd ? [errorRotateTransport, combinedRotateTransport] : []),
  ],
};
