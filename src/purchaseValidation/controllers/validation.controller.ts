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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Validation')
@ApiBearerAuth()
@Controller('validation')
@UseGuards(JwtAuthGuard)
export class DAValidationController {
  constructor(private readonly daValidationService: DAValidationService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'Liste des demandes en attente de validation',
    description: `
      Récupère toutes les demandes d'achat en attente de validation pour l'utilisateur connecté.
      Filtre automatiquement selon le rôle de l'utilisateur et l'ordre du workflow.
      Couvre toutes les étapes : DA, QR, PV, BC, etc.
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
    description: 'Liste des demandes en attente récupérée avec succès',
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
        pagination: { total: 5, page: 1, limit: 10, totalPages: 1 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Non authentifié',
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
        pagination: { total: 50, page: 1, limit: 10, totalPages: 5 },
      },
    },
  })
  async getMyHistory(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.daValidationService.getMyValidationHistory(userId, filters);
  }

  @Get('stats/me')
  @ApiOperation({
    summary: 'Mes statistiques de validation',
    description: `
      Retourne:
      - pending: Nombre de demandes en attente de ma validation
      - validated: Nombre de demandes que j'ai validées
      - rejected: Nombre de demandes que j'ai rejetées
      - changesRequested: Nombre de demandes où j'ai demandé des modifications
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

  @Get(':id')
  @ApiOperation({
    summary: "Détails d'une demande",
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
    description: 'Détails récupérés avec succès',
    schema: {
      example: {
        id: 'da-123',
        reference: 'DA-2024-0001',
        title: 'Achat matériel informatique',
        amount: 10000000,
        status: 'PUBLISHED',
        currentStep: 'DA',
        creator: { id: 1, name: 'John Doe', email: 'john@example.com' },
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

  @Post(':id/validate')
  @ApiOperation({
    summary: "Valider une demande d'achat",
    description: `
      Valide une demande à l'étape courante (DA, QR, PV, BC, etc.).
      - Vérifie que c'est bien le tour de l'utilisateur dans le workflow
      - Si tous les validateurs ont validé : passage à l'étape suivante
      - Sinon : en attente du validateur suivant
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
    examples: {
      'Avec commentaire': { value: { comment: 'Budget approuvé.' } },
      'Sans commentaire': { value: { comment: '' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demande validée avec succès',
    schema: {
      example: {
        id: 'da-123',
        status: 'VALIDATED',
        message: "DA validée avec succès, passage à l'étape de QR.",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Ce n'est pas encore votre tour",
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
    description: 'Demande ou utilisateur non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Demande n'est pas en attente de validation",
  })
  async validateDA(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() validateDto: ValidatePurchaseDto,
  ) {
    return this.daValidationService.validateDA(id, userId, validateDto);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: "Rejeter une demande d'achat",
    description: `
      Rejette une demande avec un motif obligatoire.
      Résultat : Status → REJECTED, workflow terminé, demande fermée.
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
    examples: {
      'Budget dépassé': {
        value: { comment: 'Budget insuffisant pour ce projet.' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demande rejetée avec succès',
    schema: {
      example: {
        id: 'da-123',
        status: 'REJECTED',
        observations: 'Budget insuffisant.',
        closedAt: '2024-02-02T14:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non autorisé à rejeter cette demande',
  })
  async rejectDA(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() rejectDto: RejectPurchaseDto,
  ) {
    return this.daValidationService.rejectDA(id, userId, rejectDto);
  }

  @Post(':id/request-changes')
  @ApiOperation({
    summary: 'Demander des modifications',
    description: `
      Demande des modifications. Résultat : Status → CHANGE_REQUESTED, retour au créateur.
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
    examples: {
      'Infos manquantes': {
        value: { reason: 'Veuillez préciser les spécifications techniques.' },
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
        observations: 'Spécifications à préciser.',
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
}
