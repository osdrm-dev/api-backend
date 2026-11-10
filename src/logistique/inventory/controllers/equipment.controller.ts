import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
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
import { EquipmentService } from '../services/equipment.service';
import { EquipmentDepreciationService } from '../services/equipment-depreciation.service';
import { EquipmentTriggerDaService } from '../services/equipment-trigger-da.service';
import { CreateEquipmentDto } from '../dto/create-equipment.dto';
import { UpdateEquipmentDto } from '../dto/update-equipment.dto';
import { FilterEquipmentDto } from '../dto/filter-equipment.dto';
import { TriggerDaDto } from '../dto/trigger-da.dto';

@ApiTags('Logistique - Inventaire matériel - Actifs')
@ApiBearerAuth()
@Controller('logistique/inventory/assets')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(
    private readonly assetService: EquipmentService,
    private readonly depreciationService: EquipmentDepreciationService,
    private readonly triggerDaService: EquipmentTriggerDaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les matériels' })
  findAll(@Query() query: FilterEquipmentDto) {
    return this.assetService.findAll(query);
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer un matériel (admin)' })
  create(@Body() dto: CreateEquipmentDto) {
    return this.assetService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un matériel par son ID' })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  findById(@Param('id') id: string) {
    return this.assetService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Modifier un matériel (admin)' })
  @ApiParam({ name: 'id', description: "ID de l'actif" })
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.assetService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Archiver un matériel (admin)' })
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Equipment not found',
      );
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
    summary: 'Déclencher une DA liée à un matériel (admin)',
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
