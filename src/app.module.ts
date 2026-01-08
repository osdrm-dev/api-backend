import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { winstonConfig } from './config/winston.config';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig,
      //ici on met les options exactes pour Winston
    ),
  ],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}
