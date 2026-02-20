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
import { RejectPurchaseDto } from '../dto/reject-purchase.dto';
import { RequestChangesDto } from '../dto/request-change.dto';

@ApiTags('BC Validation')
@ApiBearerAuth()
@Controller('/bc-validation')
@UseGuards(JwtAuthGuard)
export class BcValidationController {
  constructor(private readonly daValidationService: DAValidationService) {}

  /** * GET /bc-validation/pending *
   * Liste des BC en attente de validation pour l'utilisateur connecté
   * */
  @Get('/pending')
  @ApiOperation({ summary: 'Liste des BC en attente de validation' })
  async getPendingBC(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.daValidationService.getPendingDAForValidator(userId, filters);
  }

  /** * GET /bc-validation/:id * Récupérer un BC par son ID */
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un BC par ID' })
  async getBCById(@Param('id') id: string) {
    return this.daValidationService.getDAById(id);
  }

  /** * POST /bc-validation/:id/validate * Valider un BC */
  @Post(':id/validate')
  @ApiOperation({ summary: 'Valider un BC' })
  @ApiBody({ type: ValidatePurchaseDto })
  async validateBC(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() validateDto: ValidatePurchaseDto,
  ) {
    return this.daValidationService.validateDA(id, userId, validateDto);
  }

  /** * POST /bc-validation/:id/reject * Rejeter un BC */
  @Post(':id/reject')
  @ApiOperation({ summary: 'Rejeter un BC' })
  @ApiBody({ type: RejectPurchaseDto })
  async rejectBC(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body() rejectDto: RejectPurchaseDto,
  ) {
    return this.daValidationService.rejectDA(id, userId, rejectDto);
  }

  /** * POST /bc-validation/:id/request-changes * Demander des modifications sur un BC */
  @Post(':id/request-changes')
  @ApiOperation({ summary: 'Demander des modifications sur un BC' })
  @ApiBody({ type: RequestChangesDto })
  async requestChangesOnBC(
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

  /** * GET /bc-validation/history * Historique des validations de l'utilisateur */
  @Get('history')
  @ApiOperation({ summary: 'Historique de validation des BC' })
  async getMyValidationHistory(
    @CurrentUser('id') userId: number,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.daValidationService.getMyValidationHistory(userId, filters);
  }

  /** * GET /bc-validation/stats * Statistiques de validation de l'utilisateur */
  @Get('stats')
  @ApiOperation({ summary: 'Statistiques de validation des BC' })
  async getMyValidationStats(@CurrentUser('id') userId: number) {
    return this.daValidationService.getMyValidationStats(userId);
  }
}
