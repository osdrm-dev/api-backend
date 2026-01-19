import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

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

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}
void bootstrap();
