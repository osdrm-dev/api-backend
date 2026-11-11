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
import { EquipmentAttributionService } from '../services/equipment-attribution.service';
import { CreateEquipmentAttributionDto } from '../dto/create-equipment-attribution.dto';
import { ReturnEquipmentAttributionDto } from '../dto/return-equipment-attribution.dto';
import { FilterEquipmentAttributionDto } from '../dto/filter-equipment-attribution.dto';
import { FilterEquipmentHoldersDto } from '../dto/filter-equipment-holders.dto';

@ApiTags('Logistique - Inventaire matériel - Attributions')
@ApiBearerAuth()
@Controller('logistique/inventory/attributions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EquipmentAttributionController {
  constructor(private readonly service: EquipmentAttributionService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les attributions (admin)' })
  findAll(@Query() query: FilterEquipmentAttributionDto) {
    return this.service.findAll(query);
  }

  @Get('holders')
  @ApiOperation({
    summary: 'Détenteurs de matériel et leurs attributions actives (admin)',
  })
  findHolders(@Query() query: FilterEquipmentHoldersDto) {
    return this.service.findHolders(query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une attribution (admin)' })
  create(@Body() dto: CreateEquipmentAttributionDto) {
    return this.service.create(dto);
  }

  @Patch(':id/return')
  @ApiOperation({
    summary: "Enregistrer le retour d'un actif attribué (admin)",
  })
  @ApiParam({ name: 'id', description: "ID de l'attribution" })
  return(@Param('id') id: string, @Body() dto: ReturnEquipmentAttributionDto) {
    return this.service.return(id, dto);
  }
}
