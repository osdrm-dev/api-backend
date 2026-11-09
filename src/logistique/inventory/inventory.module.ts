import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BudgetModule } from 'src/budget/budget.module';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';

import { EquipmentCategoryRepository } from 'src/repository/inventory/equipment-category.repository';
import { EquipmentRepository } from 'src/repository/inventory/equipment.repository';
import { EquipmentDemandRepository } from 'src/repository/inventory/equipment-demand.repository';
import { EquipmentAttributionRepository } from 'src/repository/inventory/equipment-attribution.repository';

import { EquipmentCategoryService } from './services/equipment-category.service';
import { EquipmentService } from './services/equipment.service';
import { EquipmentDemandService } from './services/equipment-demand.service';
import { EquipmentAttributionService } from './services/equipment-attribution.service';
import { EquipmentDepreciationService } from './services/equipment-depreciation.service';
import { EquipmentTriggerDaService } from './services/equipment-trigger-da.service';
import { EquipmentDashboardService } from './services/equipment-dashboard.service';
import { EquipmentRepairService } from './services/equipment-repair.service';

import { EquipmentCategoryController } from './controllers/equipment-category.controller';
import { EquipmentController } from './controllers/equipment.controller';
import { EquipmentDemandController } from './controllers/equipment-demand.controller';
import { EquipmentAttributionController } from './controllers/equipment-attribution.controller';
import { EquipmentDashboardController } from './controllers/equipment-dashboard.controller';
import { EquipmentRepairController } from './controllers/equipment-repair.controller';

@Module({
  imports: [PrismaModule, NotificationModule, BudgetModule, MaintenanceModule],
  controllers: [
    EquipmentCategoryController,
    EquipmentController,
    EquipmentDemandController,
    EquipmentAttributionController,
    EquipmentDashboardController,
    EquipmentRepairController,
  ],
  providers: [
    EquipmentCategoryRepository,
    EquipmentRepository,
    EquipmentDemandRepository,
    EquipmentAttributionRepository,
    EquipmentCategoryService,
    EquipmentService,
    EquipmentDemandService,
    EquipmentAttributionService,
    EquipmentDepreciationService,
    EquipmentTriggerDaService,
    EquipmentDashboardService,
    EquipmentRepairService,
  ],
  exports: [EquipmentService, EquipmentDemandService],
})
export class InventoryModule {}
