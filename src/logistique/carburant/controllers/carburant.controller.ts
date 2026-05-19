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
import { LgCarburantStatus } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CarburantService } from '../carburant.service';
import { CarburantStatusService } from '../carburant-status.service';
import { CreateCarburantDto } from '../dto/create-carburant.dto';
import { FilterCarburantDto } from '../dto/filter-carburant.dto';
import { UpdateCarburantStatusDto } from '../dto/update-carburant-status.dto';

@ApiTags('Logistique - Carburant')
@ApiBearerAuth()
@Controller('logistique/carburants')
@UseGuards(JwtAuthGuard)
export class CarburantController {
  constructor(
    private readonly carburantService: CarburantService,
    private readonly carburantStatusService: CarburantStatusService,
  ) {}

  @Post()
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Enregistrer un approvisionnement carburant' })
  async create(
    @Body() dto: CreateCarburantDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.carburantService.create(dto, user.id);
  }

  // Must be declared before /:id to avoid Express matching 'stats' as an id param
  @Get('stats')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'KPIs des approvisionnements carburant' })
  async getStats() {
    return this.carburantService.getStats();
  }

  // Must be declared before /:id to avoid Express matching 'my-appros' as an id param
  @Get('my-appros')
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister mes approvisionnements carburant' })
  async getMyAppros(
    @CurrentUser() user: { id: number; role: string },
    @Query() query: FilterCarburantDto,
  ) {
    return this.carburantService.findMyAppros(user.id, query);
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister tous les approvisionnements carburant' })
  async findAll(@Query() query: FilterCarburantDto) {
    return this.carburantService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un approvisionnement par son identifiant',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.carburantService.findById(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'un approvisionnement (ADMIN)" })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCarburantStatusDto,
  ) {
    return this.carburantStatusService.updateStatus(
      id,
      dto.status as LgCarburantStatus,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler un approvisionnement carburant' })
  @ApiParam({ name: 'id', description: "Identifiant de l'approvisionnement" })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.carburantService.cancel(id, user);
  }
}
