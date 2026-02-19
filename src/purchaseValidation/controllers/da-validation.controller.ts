import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { DAValidationService } from '../services/validation.service';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { ValidatePurchaseDto } from '../dto/validate-purchase.dto';
import { RejectPurchaseDto } from '../dto/reject-purchase.dto';
import { RequestChangesDto } from '../dto/request-change.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Ajustez selon votre structure

/**
 * Controller pour la validation de DA
 * Routes pour gérer uniquement la validation des demandes d'achat
 */
@ApiTags('DA Validation') // Groupe dans Swagger
@ApiBearerAuth() // Indique que toutes les routes nécessitent un token
@Controller('da-validation')
@UseGuards(JwtAuthGuard) // Protège toutes les routes avec JWT
export class DAValidationController {
  constructor(private readonly daValidationService: DAValidationService) {}

  /**
   * GET /da-validation/pending
   * Récupère toutes les DA en attente de validation pour l'utilisateur connecté
   */
  @Get('pending')
  @ApiOperation({
    summary: 'Liste des DA en attente de validation',
    description: `
      Récupère toutes les demandes d'achat en attente de validation pour l'utilisateur connecté.
      Filtre automatiquement selon:
      - Le rôle de l'utilisateur (CEO, CFO, OM, etc.)
      - L'ordre du workflow (seulement les DA où c'est son tour)
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
    description: 'Liste des DA en attente récupérée avec succès',
    schema: {
      example: {
        data: [
          {
            id: 'da-123',
            reference: 'DA-2024-0001',
            title: 'Achat matériel informatique',
            amount: 10000000,
            operationType: 'OPERATION',
            status: 'PUBLISHED',
            currentStep: 'DA',
            validationWorkflow: {
              validators: [
                { role: 'DEMANDEUR', order: 0, isValidated: true },
                { role: 'OM', order: 1, isValidated: false },
                { role: 'CFO', order: 2, isValidated: false },
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
  async getPendingDA(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.daValidationService.getPendingDAForValidator(userId, filters);
  }

  /**
   * GET /da-validation/:id
   * Récupère les détails d'une DA spécifique
   */
  @Get(':id')
  @ApiOperation({
    summary: "Détails d'une DA",
    description:
      "Récupère les détails complets d'une demande d'achat par son ID",
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: "ID de la demande d'achat",
    example: 'da-123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Détails de la DA récupérés avec succès',
    schema: {
      example: {
        id: 'da-123',
        reference: 'DA-2024-0001',
        title: 'Achat matériel informatique',
        description: 'Ordinateurs portables pour le service IT',
        amount: 10000000,
        operationType: 'OPERATION',
        status: 'PUBLISHED',
        currentStep: 'DA',
        creator: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
        },
        items: [
          {
            id: 'item-1',
            designation: 'Laptop Dell XPS',
            quantity: 5,
            unitPrice: 2000000,
          },
        ],
        validationWorkflow: {
          validators: [
            {
              role: 'DEMANDEUR',
              order: 0,
              isValidated: true,
              validatedAt: '2024-02-01T10:00:00Z',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Demande d'achat non trouvée",
  })
  async getDADetails(@Param('id') id: string) {
    return this.daValidationService.getDAById(id);
  }

  /**
   * POST /da-validation/:id/validate
   * Valide une DA
   */
  @Post(':id/validate')
  @ApiOperation({
    summary: 'Valider une DA',
    description: `
      Valide une demande d'achat.
      
      Comportement:
      - Vérifie que l'utilisateur est autorisé (c'est son tour)
      - Enregistre la validation avec commentaire optionnel
      - Si tous les validateurs ont validé:
        * Status: PUBLISHED → VALIDATED
        * CurrentStep: DA → QR
        * Message de succès avec passage à QR
      - Sinon:
        * Status reste PUBLISHED
        * Message en attente des autres validateurs
    `,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: "ID de la demande d'achat",
    example: 'da-123',
  })
  @ApiBody({
    type: ValidatePurchaseDto,
    description: 'Données de validation',
    examples: {
      'Avec commentaire': {
        value: {
          comment: 'Budget approuvé. Validé pour passage à QR.',
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
    description: 'DA validée avec succès',
    schema: {
      example: {
        id: 'da-123',
        status: 'VALIDATED',
        currentStep: 'QR',
        message: "DA validée avec succès. Passage à l'étape QR.",
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
    description: 'DA ou utilisateur non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "DA n'est pas en attente de validation",
  })
  async validateDA(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() validateDto: ValidatePurchaseDto,
  ) {
    return this.daValidationService.validateDA(id, userId, validateDto);
  }

  /**
   * POST /da-validation/:id/reject
   * Rejette une DA
   */
  @Post(':id/reject')
  @ApiOperation({
    summary: 'Rejeter une DA',
    description: `
      Rejette une demande d'achat avec un motif obligatoire.
      
      Résultat:
      - Status: PUBLISHED → REJECTED
      - Workflow terminé
      - DA fermée (closedAt défini)
    `,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: "ID de la demande d'achat",
    example: 'da-123',
  })
  @ApiBody({
    type: RejectPurchaseDto,
    description: 'Motif du rejet (obligatoire)',
    examples: {
      'Budget dépassé': {
        value: {
          comment: 'Budget insuffisant pour ce projet.',
        },
      },
      'Non conforme': {
        value: {
          comment: 'Demande non conforme aux procédures internes.',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'DA rejetée avec succès',
    schema: {
      example: {
        id: 'da-123',
        status: 'REJECTED',
        observations: 'Budget insuffisant pour ce projet.',
        closedAt: '2024-02-02T14:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non autorisé à rejeter cette DA',
  })
  async rejectDA(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() rejectDto: RejectPurchaseDto,
  ) {
    return this.daValidationService.rejectDA(id, userId, rejectDto);
  }

  /**
   * POST /da-validation/:id/request-changes
   * Demande des modifications sur une DA
   */
  @Post(':id/request-changes')
  @ApiOperation({
    summary: 'Demander des modifications',
    description: `
      Demande des modifications sur une DA.
      
      Résultat:
      - Status: PUBLISHED → CHANGE_REQUESTED
      - DA retourne au créateur pour modifications
      - Workflow suspendu jusqu'à modification
    `,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: "ID de la demande d'achat",
    example: 'da-123',
  })
  @ApiBody({
    type: RequestChangesDto,
    description: 'Raison de la demande de modification',
    examples: {
      'Informations manquantes': {
        value: {
          reason:
            'Veuillez préciser les spécifications techniques des équipements.',
        },
      },
      'Détails à clarifier': {
        value: {
          reason: 'Les quantités doivent être justifiées par service.',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demande de modification enregistrée',
    schema: {
      example: {
        id: 'da-123',
        status: 'CHANGE_REQUESTED',
        observations: 'Veuillez préciser les spécifications techniques.',
        closedAt: '2024-02-02T14:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non autorisé à demander des modifications',
  })
  async requestChanges(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() requestChangesDto: RequestChangesDto,
  ) {
    return this.daValidationService.requestChangesOnDA(
      id,
      userId,
      requestChangesDto,
    );
  }

  /**
   * GET /da-validation/history/me
   * Récupère l'historique des validations de l'utilisateur
   */
  @Get('history/me')
  @ApiOperation({
    summary: 'Mon historique de validations',
    description:
      "Récupère l'historique complet des validations effectuées par l'utilisateur connecté",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Historique récupéré avec succès',
    schema: {
      example: {
        data: [
          {
            id: 'validator-123',
            decision: 'VALIDATED',
            comment: 'Approuvé',
            validatedAt: '2024-02-01T14:00:00Z',
            role: 'CFO',
            purchase: {
              id: 'da-123',
              reference: 'DA-2024-0001',
              title: 'Achat matériel',
            },
          },
        ],
        pagination: {
          total: 50,
          page: 1,
          limit: 10,
          totalPages: 5,
        },
      },
    },
  })
  async getMyHistory(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.daValidationService.getMyValidationHistory(userId, filters);
  }

  /**
   * GET /da-validation/stats/me
   * Récupère les statistiques de validation de l'utilisateur
   */
  @Get('stats/me')
  @ApiOperation({
    summary: 'Mes statistiques de validation',
    description: `
      Récupère les statistiques de validation de l'utilisateur.
      
      Retourne:
      - pending: Nombre de DA en attente de ma validation
      - validated: Nombre de DA que j'ai validées
      - rejected: Nombre de DA que j'ai rejetées
      - changesRequested: Nombre de DA où j'ai demandé des modifications
      - total: Total de mes actions
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistiques récupérées avec succès',
    schema: {
      example: {
        pending: 5,
        validated: 120,
        rejected: 8,
        changesRequested: 15,
        total: 143,
      },
    },
  })
  async getStats(@CurrentUser('id') userId: number) {
    return this.daValidationService.getMyValidationStats(userId);
  }
}
