import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { File as MulterFile } from 'multer';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { BauxService } from './services/baux.service';
import { BauxAvenantService } from './services/baux-avenant.service';
import { BauxPaiementService } from './services/baux-paiement.service';
import { BauxDashboardService } from './services/baux-dashboard.service';
import { CreateBailDto } from './dto/create-bail.dto';
import { UpdateBailDto } from './dto/update-bail.dto';
import { FilterBailDto } from './dto/filter-bail.dto';
import { CreateAvenantDto } from './dto/create-avenant.dto';
import { CreatePaiementDto } from './dto/create-paiement.dto';

@ApiTags('Logistique - Baux')
@ApiBearerAuth()
@Controller('logistique/baux')
@UseGuards(JwtAuthGuard)
export class BauxController {
  constructor(
    private readonly bauxService: BauxService,
    private readonly avenantService: BauxAvenantService,
    private readonly paiementService: BauxPaiementService,
    private readonly dashboardService: BauxDashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les contrats de bail' })
  async getAll(@Query() query: FilterBailDto) {
    return this.bauxService.getAll(query);
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer un contrat de bail' })
  async create(@Body() dto: CreateBailDto) {
    return this.bauxService.create(dto);
  }

  // GET /dashboard MUST be registered before GET /:id (R5)
  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs du tableau de bord des baux' })
  async getDashboard() {
    return this.dashboardService.getDashboard();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un contrat de bail par son identifiant' })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  async getById(@Param('id') id: string) {
    return this.bauxService.getById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Mettre à jour un contrat de bail' })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  async update(@Param('id') id: string, @Body() dto: UpdateBailDto) {
    return this.bauxService.update(id, dto);
  }

  @Patch(':id/archive')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Archiver un contrat de bail' })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  async archive(@Param('id') id: string) {
    return this.bauxService.archive(id);
  }

  @Post(':id/contrat')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Téléverser le PDF du contrat (max 10 MB)' })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadContrat(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: { id: number },
  ) {
    return this.bauxService.uploadContrat(id, file, user.id);
  }

  @Get(':id/avenants')
  @ApiOperation({ summary: "Lister les avenants d'un contrat" })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  async getAvenants(@Param('id') id: string) {
    return this.avenantService.listAvenants(id);
  }

  @Post(':id/avenants')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Ajouter un avenant à un contrat (PDF optionnel)' })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['numero', 'description'],
      properties: {
        file: { type: 'string', format: 'binary' },
        numero: { type: 'string' },
        dateSignature: { type: 'string', format: 'date' },
        description: { type: 'string' },
        nouveauMontant: { type: 'string' },
      },
    },
  })
  async addAvenant(
    @Param('id') id: string,
    @Body() dto: CreateAvenantDto,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: { id: number },
  ) {
    return this.avenantService.addAvenant(id, dto, file, user.id);
  }

  @Get(':id/paiements')
  @ApiOperation({ summary: "Lister les paiements d'un contrat" })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  async getPaiements(@Param('id') id: string) {
    return this.paiementService.listPaiements(id);
  }

  @Post(':id/paiements')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Enregistrer un paiement pour un contrat' })
  @ApiParam({ name: 'id', description: 'Identifiant du contrat' })
  async addPaiement(@Param('id') id: string, @Body() dto: CreatePaiementDto) {
    return this.paiementService.addPaiement(id, dto);
  }
}
