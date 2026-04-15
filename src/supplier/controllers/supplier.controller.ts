import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupplierActiveStatus } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { SupplierService } from 'src/supplier/services/supplier.service';
import { CreateSupplierDto } from 'src/supplier/dto/create-supplier.dto';
import { UpdateSupplierDto } from 'src/supplier/dto/update-supplier.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @Roles('ADMIN', 'ACHETEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiBody({
    type: CreateSupplierDto,
    examples: {
      supplierExample: {
        summary: 'Example supplier creation',
        description: 'A sample payload to create a supplier',
        value: {
          name: 'Global Trade SARL',
          status: 'active',
          nif: '123456789',
          stat: 'STAT001',
          rcs: 'RCS001',
          region: 'Analamanga',
          address: 'Lot II A 45, Antananarivo',
          phone: '+261 34 12 345 67',
          email: 'contact@globaltrade.mg',
          label: 'Main distributor',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Supplier successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  async create(@Body() dto: CreateSupplierDto) {
    return this.supplierService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all suppliers with optional filters' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by supplier status',
  })
  @ApiQuery({
    name: 'region',
    required: false,
    description: 'Filter by region',
  })
  @ApiQuery({
    name: 'activeStatus',
    required: false,
    enum: SupplierActiveStatus,
    description: 'Filter by active status (ACTIVE, INACTIVE, BLACK_LIST)',
  })
  @ApiResponse({ status: 200, description: 'List of suppliers returned.' })
  async findAll(@Query() filters: any) {
    return this.supplierService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiParam({ name: 'id', description: 'Supplier unique identifier' })
  @ApiResponse({ status: 200, description: 'Supplier found.' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  async findOne(@Param('id') id: string) {
    return this.supplierService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'ACHETEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update supplier details' })
  @ApiParam({ name: 'id', description: 'Supplier unique identifier' })
  @ApiBody({
    type: UpdateSupplierDto,
    examples: {
      updateExample: {
        summary: 'Example supplier update',
        description: 'A sample payload to update supplier details',
        value: {
          name: 'Global Trade SARL Updated',
          status: 'inactive',
          region: 'Atsinanana',
          address: 'Rue du Port, Toamasina',
          phone: '+261 32 98 765 43',
          email: 'newcontact@globaltrade.mg',
          label: 'Updated distributor',
          active: false,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Supplier successfully updated.' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.supplierService.update(id, dto);
  }

  @Put(':id/status')
  @Roles('ADMIN', 'ACHETEUR')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update the active status of a supplier' })
  @ApiParam({ name: 'id', description: 'Supplier unique identifier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        activeStatus: {
          type: 'string',
          enum: Object.values(SupplierActiveStatus),
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Supplier status updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status value.' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  async setStatus(
    @Param('id') id: string,
    @Body('activeStatus') activeStatus: SupplierActiveStatus,
  ) {
    if (!Object.values(SupplierActiveStatus).includes(activeStatus)) {
      throw new BadRequestException(
        `activeStatus must be one of: ${Object.values(SupplierActiveStatus).join(', ')}`,
      );
    }
    return this.supplierService.setStatus(id, activeStatus);
  }
}
