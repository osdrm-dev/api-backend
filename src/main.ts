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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {

  
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const configService = app.get(ConfigService);
  const environment = configService.get<string>('NODE_ENV');

  if (environment !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OSDRM API')
      .setDescription('REST API OSDRM project 2026')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'access-token',
      )
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
