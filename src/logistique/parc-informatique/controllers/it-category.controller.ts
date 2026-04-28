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
import { ItCategoryService } from '../services/it-category.service';
import { CreateItCategoryDto } from '../dto/create-it-category.dto';
import { UpdateItCategoryDto } from '../dto/update-it-category.dto';

@ApiTags('Logistique - Parc Informatique - Catégories')
@ApiBearerAuth()
@Controller('logistique/parc-informatique/categories')
@UseGuards(JwtAuthGuard)
export class ItCategoryController {
  constructor(private readonly service: ItCategoryService) {}

  @Get()
  @ApiOperation({ summary: "Lister les catégories d'actifs informatiques" })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer une catégorie (admin)' })
  create(@Body() dto: CreateItCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Modifier une catégorie (admin)' })
  @ApiParam({ name: 'id', description: 'ID de la catégorie' })
  update(@Param('id') id: string, @Body() dto: UpdateItCategoryDto) {
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
