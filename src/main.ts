import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const environment = configService.get<string>('NODE_ENV');

  if (environment !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OSDRM API')
      .setDescription('REST API OSDRM project 2026')
      .setVersion('1.0')
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
