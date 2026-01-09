import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement en premier
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const envResult = dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

if (envResult.error && ((envResult.error as NodeJS.ErrnoException).code ?? '') !== 'ENOENT') {
  console.warn('Avertissement: Impossible de charger le fichier .env');
}
import { AppModule } from './app.module';

async function bootstrap() {

  
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
