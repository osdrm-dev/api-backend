import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { File as MulterFile } from 'multer';
import { ParcAutoService } from './parc-auto.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('Logistique - Parc Auto')
@ApiBearerAuth()
@Controller('logistique/parc-auto')
@UseGuards(JwtAuthGuard)
export class ParcAutoController {
  constructor(private readonly parcAutoService: ParcAutoService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les véhicules du parc auto' })
  async getAll(@Query() query: ListVehiclesQueryDto) {
    return this.parcAutoService.getAll(query);
  }

  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Créer un nouveau véhicule' })
  async create(@Body() dto: CreateVehicleDto) {
    return this.parcAutoService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un véhicule par son identifiant' })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  async getById(@Param('id') id: string) {
    return this.parcAutoService.getById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Mettre à jour un véhicule' })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  async update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.parcAutoService.update(id, dto);
  }

  @Patch(':id/archive')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Archiver un véhicule' })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  async archive(@Param('id') id: string) {
    return this.parcAutoService.archive(id);
  }

  @Get(':id/photos')
  @ApiOperation({
    summary: "Récupérer les photos d'un véhicule avec les fichiers associés",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  async getPhotos(@Param('id') id: string) {
    return this.parcAutoService.getPhotos(id);
  }

  @Post(':id/photos')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UseInterceptors(FilesInterceptor('files', 5))
  @ApiOperation({ summary: 'Ajouter des photos à un véhicule (max 5)' })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  async uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() files: MulterFile[],
    @CurrentUser() user: { id: number },
  ) {
    return this.parcAutoService.uploadPhotos(id, files, user.id);
  }

  @Delete(':id/photos/:fileId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Supprimer une photo d'un véhicule" })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  @ApiParam({ name: 'fileId', description: 'ID du fichier photo à supprimer' })
  async deletePhoto(@Param('id') id: string, @Param('fileId') fileId: string) {
    return this.parcAutoService.deletePhoto(id, parseInt(fileId, 10));
  }

  @Get(':id/documents')
  @ApiOperation({
    summary: "Récupérer les documents d'un véhicule, groupés par type",
  })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  async getDocuments(@Param('id') id: string) {
    return this.parcAutoService.getDocuments(id);
  }

  @Post(':id/documents')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Téléverser un document pour un véhicule' })
  @ApiParam({ name: 'id', description: 'Identifiant du véhicule' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type', 'dateExpiration'],
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: ['ASSURANCE', 'VISITE_TECHNIQUE', 'CARTE_GRISE'],
        },
        reference: { type: 'string' },
        dateDebut: { type: 'string', format: 'date' },
        dateExpiration: { type: 'string', format: 'date' },
      },
    },
  })
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.parcAutoService.uploadDocument(id, file, dto, user.id);
  }
}
