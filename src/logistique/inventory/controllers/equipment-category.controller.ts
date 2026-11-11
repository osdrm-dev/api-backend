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
import { EquipmentCategoryService } from '../services/equipment-category.service';
import { CreateEquipmentCategoryDto } from '../dto/create-equipment-category.dto';
import { UpdateEquipmentCategoryDto } from '../dto/update-equipment-category.dto';

@ApiTags('Logistique - Inventaire matériel - Catégories')
@ApiBearerAuth()
@Controller('logistique/inventory/categories')
@UseGuards(JwtAuthGuard)
export class EquipmentCategoryController {
  constructor(private readonly service: EquipmentCategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les catégories de matériel' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer une catégorie (admin)' })
  create(@Body() dto: CreateEquipmentCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Modifier une catégorie (admin)' })
  @ApiParam({ name: 'id', description: 'ID de la catégorie' })
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Supprimer une catégorie (admin)' })
  @ApiParam({ name: 'id', description: 'ID de la catégorie' })
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
