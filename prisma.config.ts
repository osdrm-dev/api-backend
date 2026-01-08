import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: isProd ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_DEV,
  },
});
