import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { File as MulterFile } from 'multer';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SignaturesService } from '../services/signatures.service';

@ApiTags('Signatures')
@ApiBearerAuth('JWT-auth')
@Controller('signatures')
@UseGuards(JwtAuthGuard)
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Get()
  @ApiOperation({ summary: "Liste les spécimens de l'utilisateur courant" })
  findAll(@Request() req: any) {
    return this.signaturesService.findAll(req.user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Retourne le spécimen actif ou 404' })
  findActive(@Request() req: any) {
    return this.signaturesService.findActive(req.user.id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Téléverse un nouveau spécimen de signature' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  upload(@UploadedFile() file: MulterFile, @Request() req: any) {
    return this.signaturesService.upload(file, req.user.id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Active un spécimen (désactive les autres)' })
  activate(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.signaturesService.activate(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprime un spécimen de signature' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.signaturesService.remove(id, req.user.id);
  }
}
