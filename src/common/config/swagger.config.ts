import { INestApplication } from '@nestjs/common';
import {
  ApiProperty,
  ApiPropertyOptional,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

/** Shared error body returned by AllExceptionsFilter (registered as a component in main.ts). */
export class ApiErrorResponse {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'VALIDATION_FAILED' }) code: string;
  @ApiProperty({ example: 'Validation failed: status isNotEmpty' })
  message: string;
  @ApiPropertyOptional({
    example: [{ field: 'items.0.quantity', code: 'isPositive' }],
  })
  fields?: { field: string; code: string }[];
  @ApiPropertyOptional({ example: { id: 3 } })
  params?: Record<string, string | number>;
  @ApiProperty({ example: '/suppliers' }) path: string;
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' }) timestamp: string;
}

export class SwaggerConfig {
  static setup(app: INestApplication): void {
    const config = new DocumentBuilder()
      .setTitle('Purchase Management API')
      .setDescription(
        "API pour la gestion des demandes d'achat (DA) et leur validation",
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Entrez votre token JWT',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag(
        'Authentication',
        "Endpoints pour l'authentification et la gestion des utilisateurs",
      )
      .addTag('DA Creation', "Endpoints pour la creation de demandes d'achat")
      .addTag(
        'DA Validation',
        "Endpoints pour la validation des demandes d'achat",
      )
      .addTag(
        'QR Management',
        'Endpoints pour la gestion des devis (Quotation Request)',
      )
      .addTag('Derogation', 'Endpoints pour la gestion des derogations')
      .addTag('Audit', "Endpoints pour les logs d'audit")
      .addTag(
        'Dashboard',
        'Endpoints pour les statistiques et tableaux de bord',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, document, {
      jsonDocumentUrl: 'documentation-json',
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Purchase API Documentation',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .scheme-container { margin: 20px 0; }
      `,
    });
  }
}
