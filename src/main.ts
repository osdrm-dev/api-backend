import * as dotenv from 'dotenv';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

const envResult = dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

if (
  envResult.error &&
  ((envResult.error as NodeJS.ErrnoException).code ?? '') !== 'ENOENT'
) {
  console.warn('Avertissement: Impossible de charger le fichier .env');
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: true,
  });

  // Augmenter le timeout pour les bases distantes
  const server = app.getHttpServer();
  server.setTimeout(60000); // 60 secondes
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Servir les fichiers statiques
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const allowedOrigins = [
    'https://osdrm.netlify.app',
    'http://localhost:5173',
    'https://osdrm-recette.hrtechnology.online',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 3600,
  });

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

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  if (environment !== 'production') {
    console.log(
      `Swagger documentation: http://localhost:${port}/documentation`,
    );
  }
}
void bootstrap();
