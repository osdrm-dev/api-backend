import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Request,
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

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BudgetTableService } from '../services/budget-table.service';
import { UploadBudgetDto } from '../dto/upload-budget.dto';

@ApiTags('Budget Tables')
@ApiBearerAuth('JWT-auth')
@Controller('budget-tables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetTableController {
  constructor(private readonly budgetService: BudgetTableService) {}

  @Post('upload')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload and preview a new budget table CSV (ADMIN)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        label: { type: 'string' },
      },
      required: ['file', 'label'],
    },
  })
  async upload(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadBudgetDto,
    @Request() req: any,
  ) {
    return this.budgetService.uploadAndPreview(file, req.user.id, dto.label);
  }

  @Post(':id/activate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Activate a pending budget table (ADMIN)' })
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.budgetService.activate(id);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List budget table versions (ADMIN)' })
  async list(@Query('page') page = '1', @Query('limit') limit = '10') {
    return this.budgetService.listVersions(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get('active')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get the currently active budget table (ADMIN)' })
  async getActive() {
    return this.budgetService.getActive();
  }

  @Get('active/projects')
  @ApiOperation({
    summary:
      'Get the list of projects from the active table (any authenticated user)',
  })
  async getActiveProjects() {
    return this.budgetService.getActiveProjects();
  }

  @Get('active/projects/:projectCode')
  @ApiOperation({
    summary:
      'Get imputation fields for a project from the active table (any authenticated user)',
  })
  async getActiveProjectByCode(@Param('projectCode') projectCode: string) {
    return this.budgetService.getActiveProjectByCode(projectCode);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get a budget table by ID with all projects (ADMIN)',
  })
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.budgetService.getById(id);
  }
}
