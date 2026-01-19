import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  INestApplication,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const connectionString = isProd
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['error'],
    });
  }

  async onModuleInit() {
    try {
      console.log('Prisma connected to database');
    } catch (error) {
      console.error('Failed to connect to database:', error);
    }
  }

  async onModuleDestroy() {
    await (this as any).$disconnect();
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
