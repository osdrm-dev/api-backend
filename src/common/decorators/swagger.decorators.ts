import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export const ApiUnauthorizedResponse = () =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Non authentifie - Token manquant ou invalide',
      schema: {
        example: {
          statusCode: 401,
          message: 'Unauthorized',
        },
      },
    }),
  );

export const ApiForbiddenResponse = () =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Acces refuse - Permissions insuffisantes',
      schema: {
        example: {
          statusCode: 403,
          message: 'Forbidden resource',
        },
      },
    }),
  );

export const ApiNotFoundResponse = (resource: string = 'Ressource') =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: `${resource} non trouvee`,
      schema: {
        example: {
          statusCode: 404,
          message: `${resource} non trouvee`,
        },
      },
    }),
  );

export const ApiBadRequestResponse = (message?: string) =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: message || 'Requete invalide',
      schema: {
        example: {
          statusCode: 400,
          message: message || 'Bad Request',
          error: 'Bad Request',
        },
      },
    }),
  );

export const ApiSuccessResponse = (description: string, example: any) =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.OK,
      description,
      schema: { example },
    }),
  );

export const ApiCreatedResponse = (description: string, example: any) =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.CREATED,
      description,
      schema: { example },
    }),
  );

export const ApiCommonResponses = () =>
  applyDecorators(ApiUnauthorizedResponse(), ApiForbiddenResponse());

export const ApiPaginatedResponse = (itemExample: any) =>
  applyDecorators(
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste paginee recuperee avec succes',
      schema: {
        example: {
          data: [itemExample],
          pagination: {
            total: 100,
            page: 1,
            limit: 10,
            totalPages: 10,
          },
        },
      },
    }),
  );
