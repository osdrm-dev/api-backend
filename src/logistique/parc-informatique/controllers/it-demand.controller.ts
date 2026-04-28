import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ItDemandService } from '../services/it-demand.service';
import { ItTriggerDaService } from '../services/it-trigger-da.service';
import { CreateItDemandDto } from '../dto/create-it-demand.dto';
import { UpdateItDemandStatusDto } from '../dto/update-it-demand-status.dto';
import { FilterItDemandDto } from '../dto/filter-it-demand.dto';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@ApiTags('Logistique - Parc Informatique - Demandes')
@ApiBearerAuth()
@Controller('logistique/parc-informatique/demands')
@UseGuards(JwtAuthGuard)
export class ItDemandController {
  constructor(
    private readonly demandService: ItDemandService,
    private readonly triggerDaService: ItTriggerDaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les demandes informatiques' })
  findAll(
    @Query() query: FilterItDemandDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    if (user.role === 'ADMIN') {
      return this.demandService.findAll(query);
    }
    return this.demandService.findAllForRequestor(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une demande informatique' })
  create(@Body() dto: CreateItDemandDto, @CurrentUser('id') userId: number) {
    return this.demandService.create(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une demande informatique par son ID' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    if (user.role === 'ADMIN') {
      return this.demandService.findById(id);
    }
    return this.demandService.findByIdForUser(id, user.id);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'une demande (admin)" })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateItDemandStatusDto,
    @CurrentUser('id') adminUserId: number,
  ) {
    return this.demandService.updateStatus(id, dto, adminUserId);
  }

  @Post(':id/trigger-da')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Déclencher une DA liée à une demande informatique (admin)',
  })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  triggerDa(
    @Param('id') id: string,
    @Body() dto: TriggerDaDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.triggerDaService.triggerForDemand(id, userId, dto);
  }
}
