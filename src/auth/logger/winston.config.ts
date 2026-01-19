import * as winston from 'winston';
import { getHostname } from './hostname.util';
import { getIPAdress } from './hostinfo.util';
import 'winston-daily-rotate-file';

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL;

const errorRotateTransport = new (winston.transports as any).DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  level: 'error',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '72h',
});

const combinedRotateTransport = new (winston.transports as any).DailyRotateFile(
  {
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    level: logLevel,
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '72h',
  },
);

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
              return `[${timestamp}] [${context ?? 'App'}] [${hostname}] [${ip}]${level}: ${message}`;
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
