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
import { LgTripStatus } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { TripService } from '../services/trip.service';
import { TripStatusService } from '../services/trip-status.service';
import { CreateTripDto } from '../dto/create-trip.dto';
import { FilterTripDto } from '../dto/filter-trip.dto';
import { UpdateTripStatusDto } from '../dto/update-trip-status.dto';

@ApiTags('Logistique - Trajets')
@ApiBearerAuth()
@Controller('logistique/trips')
@UseGuards(JwtAuthGuard)
export class TripController {
  constructor(
    private readonly tripService: TripService,
    private readonly tripStatusService: TripStatusService,
  ) {}

  @Post()
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soumettre une demande de trajet' })
  async create(
    @Body() dto: CreateTripDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.tripService.create(dto, user.id);
  }

  // Must be declared before /:id to avoid Express matching 'stats' as an id param
  @Get('stats')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'KPIs des trajets par statut' })
  async getStats() {
    return this.tripService.getStats();
  }

  // Must be declared before /:id to avoid Express matching 'my-trips' as an id param
  @Get('my-trips')
  @Roles('DEMANDEUR', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister mes demandes de trajet' })
  async getMyTrips(
    @CurrentUser() user: { id: number; role: string },
    @Query() query: FilterTripDto,
  ) {
    return this.tripService.findMyTrips(user.id, query);
  }

  @Get()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lister toutes les demandes de trajet' })
  async findAll(@Query() query: FilterTripDto) {
    return this.tripService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un trajet par son identifiant' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.tripService.findById(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Changer le statut d'un trajet (ADMIN)" })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.tripStatusService.updateStatus(id, dto.status as LgTripStatus);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler un trajet' })
  @ApiParam({ name: 'id', description: 'Identifiant du trajet' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.tripService.cancel(id, user);
  }
}
