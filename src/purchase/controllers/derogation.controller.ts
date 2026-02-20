import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DerogationService } from '../services/derogation.service';
import { ValidateDerogationDto } from '../dto/derogation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiSuccessResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiCommonResponses,
  ApiPaginatedResponse,
} from '../../common/decorators/swagger.decorators';

@ApiTags('Derogation')
@ApiBearerAuth('JWT-auth')
@Controller('derogations')
@UseGuards(JwtAuthGuard)
export class DerogationController {
  constructor(private readonly derogationService: DerogationService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'Lister les derogations en attente',
    description: 'Recupere toutes les derogations en attente de validation',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiPaginatedResponse({
    id: 'derog-123',
    reason: 'Devis insuffisants',
    status: 'PENDING',
    purchase: {},
  })
  @ApiCommonResponses()
  async getPendingDerogations(@Request() req, @Query() filters: any) {
    return this.derogationService.getPendingDerogations(req.user.id, filters);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Historique des derogations',
    description: "Recupere l'historique des derogations traitees",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiPaginatedResponse({
    id: 'derog-123',
    status: 'VALIDATED',
    approvedBy: 'John Doe',
  })
  @ApiCommonResponses()
  async getDerogationHistory(@Request() req, @Query() filters: any) {
    return this.derogationService.getDerogationHistory(req.user.id, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Details d'une derogation",
    description: "Recupere les details complets d'une derogation",
  })
  @ApiParam({ name: 'id', description: 'ID de la derogation' })
  @ApiSuccessResponse('Details de la derogation', {
    id: 'derog-123',
    reason: 'Devis insuffisants',
    justification: 'Marche tres specifique',
    status: 'PENDING',
    purchase: {},
  })
  @ApiNotFoundResponse('Derogation')
  @ApiCommonResponses()
  async getDerogation(@Param('id') id: string) {
    return this.derogationService.getDerogationById(id);
  }

  @Post(':id/validate')
  @ApiOperation({
    summary: 'Valider ou rejeter une derogation',
    description: `
      Valide ou rejete une derogation.
      
      Si approuvee: Purchase revient en PUBLISHED
      Si rejetee: Purchase passe en REJECTED
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la derogation' })
  @ApiBody({ type: ValidateDerogationDto })
  @ApiSuccessResponse('Derogation traitee', {
    id: 'derog-123',
    status: 'VALIDATED',
    message: 'Derogation approuvee avec succes',
  })
  @ApiNotFoundResponse('Derogation')
  @ApiBadRequestResponse('Derogation deja traitee')
  @ApiCommonResponses()
  async validateDerogation(
    @Param('id') id: string,
    @Request() req,
    @Body() validateDto: ValidateDerogationDto,
  ) {
    return this.derogationService.validateDerogation(
      id,
      req.user.id,
      validateDto,
    );
  }
}
