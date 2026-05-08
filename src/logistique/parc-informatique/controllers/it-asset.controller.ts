import {
  Body,
  Controller,
  Delete,
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
import { ItAssetService } from '../services/it-asset.service';
import { ItDepreciationService } from '../services/it-depreciation.service';
import { ItTriggerDaService } from '../services/it-trigger-da.service';
import { CreateItAssetDto } from '../dto/create-it-asset.dto';
import { UpdateItAssetDto } from '../dto/update-it-asset.dto';
import { FilterItAssetDto } from '../dto/filter-it-asset.dto';
import { TriggerDaDto } from '../dto/trigger-da.dto';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Logistique - Parc Informatique - Actifs')
@ApiBearerAuth()
@Controller('logistique/parc-informatique/assets')
@UseGuards(JwtAuthGuard)
export class ItAssetController {
  constructor(
    private readonly assetService: ItAssetService,
    private readonly depreciationService: ItDepreciationService,
    private readonly triggerDaService: ItTriggerDaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les actifs informatiques' })
  findAll(@Query() query: FilterItAssetDto) {
    return this.assetService.findAll(query);
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer un actif informatique (admin)' })
  create(@Body() dto: CreateItAssetDto) {
    return this.assetService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un actif informatique par son ID' })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  findById(@Param('id') id: string) {
    return this.assetService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Modifier un actif informatique (admin)' })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  update(@Param('id') id: string, @Body() dto: UpdateItAssetDto) {
    return this.assetService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Archiver un actif informatique (admin)' })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  archive(@Param('id') id: string) {
    return this.assetService.archive(id);
  }

  @Get(':id/amortissement')
  @ApiOperation({ summary: "Calculer le tableau d'amortissement d'un actif" })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  async getAmortissement(@Param('id') id: string) {
    const asset = await this.assetService.findById(id);
    if (!asset) {
      throw new NotFoundException('Actif informatique introuvable.');
    }
    const duree =
      asset.depreciationOverrideYears ?? asset.category?.depreciationYears ?? 3;
    return this.depreciationService.computeTable(
      Number(asset.purchasePrice),
      new Date(asset.acquisitionDate),
      duree,
    );
  }

  @Post(':id/trigger-da')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Déclencher une DA liée à un actif informatique (admin)',
  })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  triggerDa(
    @Param('id') id: string,
    @Body() dto: TriggerDaDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.triggerDaService.triggerForAsset(id, userId, dto);
  }
}
