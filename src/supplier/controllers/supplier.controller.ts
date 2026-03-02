import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { SupplierService } from '../services/supplier.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';

@ApiTags('Suppliers')
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
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
    name: 'active',
    required: false,
    description: 'Filter by active state',
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

  @Put(':id/active')
  @ApiOperation({ summary: 'Activate or deactivate a supplier' })
  @ApiParam({ name: 'id', description: 'Supplier unique identifier' })
  @ApiBody({
    schema: { type: 'object', properties: { active: { type: 'boolean' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Supplier activation status updated.',
  })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  async setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.supplierService.setActive(id, active);
  }
}
