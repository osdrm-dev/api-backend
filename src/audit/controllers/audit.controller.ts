import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from 'src/audit/services/audit.service';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { ApiOperation, ApiTags, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Tracabilité/audit')
@Controller('audits')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all audits logs (Admin only)' })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'Filtrer par ID utilisateur',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: 'Filtrer par action (ex: LOGIN, CREATE)',
  })
  @ApiQuery({
    name: 'userName',
    required: false,
    type: String,
    description: "Filtrer par nom d'utilisateur",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (ISO)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (ISO)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre maximum de résultats',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des logs d’audit récupérée avec succès',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit (non-admin)' })
  async getAllAuditLogs(@Query() filters: any) {
    return this.auditService.getAllAuditLogs(filters);
  }

  @Get('export')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Export audits as CSV (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Export CSV des audits',
  })
  async exportAuditsCsv(@Query() filters: any, @Res() res: Response) {
    const csvBuffer = await this.auditService.generateAuditsCsv(filters);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audits.csv"');
    res.setHeader('Content-Length', String(csvBuffer.length));

    res.end(csvBuffer);
  }
}
