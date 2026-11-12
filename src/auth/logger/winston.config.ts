import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getHostname } from './hostname.util';
import { getIPAdress } from './hostinfo.util';

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL;
// Computed once: these don't change while the process runs.
const hostname = getHostname();
const ip = getIPAdress();

// Only built in prod, otherwise they create empty files every hour.
const fileTransports = isProd
  ? [
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        level: 'error',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '72h',
      }),
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        level: logLevel,
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '72h',
      }),
    ]
  : [];

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
    winston.format.timestamp(), // ISO 8601 UTC with ms
    winston.format.errors({ stack: true }),

    winston.format((info) => {
      info.hostname = hostname;
      info.ip = ip;
      info.environment = process.env.NODE_ENV || 'development';
      return info;
    })(),

    ...(isProd
      ? [winston.format.json()]
      : [
          winston.format.colorize({ all: true }),
          winston.format.printf(
            ({ timestamp, level, message, context, stack, trace, ...meta }) => {
              // Constant per process: noise in a dev console.
              delete meta.hostname;
              delete meta.ip;
              delete meta.environment;
              const ctx = typeof context === 'string' ? context : 'App';
              // nest-winston passes stack as an array, LoggerService as `trace`.
              const st = [stack, trace].flat().filter(Boolean).join('\n');
              // HTTP lines already carry their meta in the message.
              const extra =
                ctx !== 'HTTP' && Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
              return `[${String(timestamp)}] [${ctx}] ${String(level)}: ${String(message)}${extra}${st ? `\n${st}` : ''}`;
            },
          ),
        ]),
  ),

  transports: [
    new winston.transports.Console({
      level: logLevel || 'info',
    }),
    ...fileTransports,
  ],
};
