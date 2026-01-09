import * as winston from 'winston';
import { getHostname } from './hostname.util';
import { WinstonModuleOptions } from 'nest-winston';

const isProd = process.env.NODE_ENV === 'production';



export const winstonConfig = {
  
  levels : {
    error : 0,
    warn :1,
    info :2,
    http :3,
    debug :4,
  },

  level: isProd ? 'info' : 'debug',

  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss'}),

    winston.format((info) => {
      info.hostname = getHostname();
      info.environment = process.env.NODE_ENV || 'development';
      return info;
    })(),

    ...(isProd
      ? [ winston.format.json()]
      : [winston.format.colorize({all : true}),
        winston.format.printf(({ timestamp, level, message, hostname, context }) => {
          return `[${timestamp}] [${context ?? 'App'}] [${hostname}] ${level}: ${message}`;
        }), 
      ]
    ),
  ),
  transports : [
      new winston.transports.Console(),

      ...(isProd
        ?[
          new winston.transports.File({ filename: 'logs/error.log', level: 'error', }),
          new winston.transports.File({filename: 'logs/combined.log' }),
        ]

        : []
      ),

    ],

};
