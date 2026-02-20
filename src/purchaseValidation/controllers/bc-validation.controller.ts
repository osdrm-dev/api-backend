import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DAValidationService } from '../services/validation.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ValidatePurchaseDto } from '../dto/validate-purchase.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('BC Validation') // Groupe dans Swagger
@ApiBearerAuth() // Indique que toutes les routes nécessitent un token
@Controller('bc-validation')
@UseGuards(JwtAuthGuard)
export class BcValidationController {
  constructor(private readonly daValidationService: DAValidationService) {}

  /* GET /bc-validation/pending
   * Récupère toutes les BC en attente de validation pour l'utilisateur connecté
   */
  @Get('pending')
  @ApiOperation({
    summary: 'Liste des BC en attente de validation',
    description: `
              Récupère toutes les bons de commande en attente de validation pour l'utilisateur connecté.
              Filtre automatiquement selon:
              - Le rôle de l'utilisateur (OM,RFR, CPR.)
              - L'ordre du workflow (seulement les BC où c'est son tour)
              - Les critères de recherche optionnels
            `,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    example: 'PUBLISHED',
  })
  @ApiQuery({ name: 'project', required: false, type: String })
  @ApiQuery({ name: 'region', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des BC en attente récupérée avec succès',
    schema: {
      example: {
        data: [
          {
            id: 'bc-123',
            reference: 'BC-2024-0001',
            title: 'Bon de commande matériel informatique',
            amount: 10000000,
            operationType: 'OPERATION',
            status: 'PUBLISHED',
            currentStep: 'BC',
            validationWorkflow: {
              validators: [
                { role: 'OM', order: 0, isValidated: true },
                { role: 'RFR', order: 1, isValidated: false },
                { role: 'CPR', order: 2, isValidated: false },
              ],
            },
          },
        ],
        pagination: {
          total: 5,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Non authentifié - Token manquant ou invalide',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Utilisateur non trouvé',
  })
  async getPendingBC(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.daValidationService.getPendingDAForValidator(userId, filters);
  }

  /**
   * POST /bc-validation/:id/validate
   * Valide une DA
   */
  @Post(':id/validate')
  @ApiOperation({
    summary: 'Valider une BC',
    description: `
          Valide une bon de commande.
          
          Comportement:
          - Vérifie que l'utilisateur est autorisé (c'est son tour)
          - Enregistre la validation avec commentaire optionnel
          - Si tous les validateurs ont validé:
            * Status: PUBLISHED → VALIDATED
            * CurrentStep: BC → BR
            * Message de succès avec passage à BR
          - Sinon:
            * Status reste PUBLISHED
            * Message en attente des autres validateurs
        `,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID du bon de commande',
    example: 'da-123',
  })
  @ApiBody({
    type: ValidatePurchaseDto,
    description: 'Données de validation',
    examples: {
      'Avec commentaire': {
        value: {
          comment: 'Budget approuvé. Validé pour passage à BC.',
        },
      },
      'Sans commentaire': {
        value: {
          comment: '',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'BC validée avec succès',
    schema: {
      example: {
        id: 'da-123',
        status: 'VALIDATED',
        currentStep: 'BC',
        message: "BC validée avec succès. Passage à l'étape BR.",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Non autorisé - Ce n'est pas encore votre tour",
    schema: {
      example: {
        statusCode: 403,
        message:
          "Ce n'est pas encore votre tour dans le workflow de validation",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'BC ou utilisateur non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "BC n'est pas en attente de validation",
  })
  async validateDA(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() validateDto: ValidatePurchaseDto,
  ) {
    return this.daValidationService.validateDA(id, userId, validateDto);
  }
}
