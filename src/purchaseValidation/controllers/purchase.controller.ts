import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PurchaseService } from '../services/purchase.service';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { RejectPurchaseDto } from '../dto/reject-purchase.dto';
import { ValidatePurchaseDto } from '../dto/validate-purchase.dto';
import { RequestChangesDto } from '../dto/request-change.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  //API Listes des DA à valider par le demandeur
  //GET /purchases/validator
  //filtres supportés: status, currentStep, project, region, search, page, sortBy, sortByOrder
  @Get()
  @Roles('OM', 'CFO', 'CEO', 'DP', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async findAllforValidator(
    @Request() req,
    @Query() filters: FilterPurchaseDto,
  ) {
    return this.purchaseService.findAllForValidator(req.user.id, filters);
  }

  //API voir les details d'une DA
  //GET /purchases/:id
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.purchaseService.findOne(id);
  }

  //API Valider une DA
  //PATCH /purchases/:id/validate
  @Patch(':id/validate')
  @Roles('OM', 'CFO', 'CEO', 'DP', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async validate(
    @Param('id') id: string,
    @Body() validateDto: ValidatePurchaseDto,
    @Request() req,
  ) {
    return this.purchaseService.validatePurchase(id, req.user.id, validateDto);
  }

  //demander des modifications
  //PATCH /purchases/:id/request-changes
  @Patch(':id/request-changes')
  @Roles('OM', 'CFO', 'CEO', 'DP', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async requestChanges(
    @Param('id') id: string,
    @Body() requestChangesDto: RequestChangesDto,
    @Request() req,
  ) {
    return this.purchaseService.requestChanges(
      id,
      req.user.id,
      requestChangesDto,
    );
  }

  //API rejeter une DA
  //PATCH /purchases/:id/reject
  @Patch(':id/reject')
  @Roles('OM', 'CFO', 'CEO', 'DP', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() rejectDto: RejectPurchaseDto,
    @Request() req,
  ) {
    return this.purchaseService.rejectPurchase(id, req.user.id, rejectDto);
  }
}
