import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/winston.config';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {

  
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
