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
import { ItAttributionService } from '../services/it-attribution.service';
import { CreateItAttributionDto } from '../dto/create-it-attribution.dto';
import { ReturnItAttributionDto } from '../dto/return-it-attribution.dto';
import { FilterItAttributionDto } from '../dto/filter-it-attribution.dto';

@ApiTags('Logistique - Parc Informatique - Attributions')
@ApiBearerAuth()
@Controller('logistique/parc-informatique/attributions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ItAttributionController {
  constructor(private readonly service: ItAttributionService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les attributions (admin)' })
  findAll(@Query() query: FilterItAttributionDto) {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une attribution (admin)' })
  create(@Body() dto: CreateItAttributionDto) {
    return this.service.create(dto);
  }

  @Patch(':id/return')
  @ApiOperation({
    summary: "Enregistrer le retour d'un actif attribué (admin)",
  })
  @ApiParam({ name: 'id', description: "ID de l'attribution" })
  return(@Param('id') id: string, @Body() dto: ReturnItAttributionDto) {
    return this.service.return(id, dto);
  }
}
