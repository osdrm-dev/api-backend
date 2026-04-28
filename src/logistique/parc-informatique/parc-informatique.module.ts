import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';
import { BudgetModule } from 'src/budget/budget.module';

import { ItCategoryRepository } from 'src/repository/parc-informatique/it-category.repository';
import { ItAssetRepository } from 'src/repository/parc-informatique/it-asset.repository';
import { ItDemandRepository } from 'src/repository/parc-informatique/it-demand.repository';
import { ItAttributionRepository } from 'src/repository/parc-informatique/it-attribution.repository';

import { ItCategoryService } from './services/it-category.service';
import { ItAssetService } from './services/it-asset.service';
import { ItDemandService } from './services/it-demand.service';
import { ItAttributionService } from './services/it-attribution.service';
import { ItDepreciationService } from './services/it-depreciation.service';
import { ItTriggerDaService } from './services/it-trigger-da.service';
import { ItDashboardService } from './services/it-dashboard.service';

import { ItCategoryController } from './controllers/it-category.controller';
import { ItAssetController } from './controllers/it-asset.controller';
import { ItDemandController } from './controllers/it-demand.controller';
import { ItAttributionController } from './controllers/it-attribution.controller';
import { ItDashboardController } from './controllers/it-dashboard.controller';

@Module({
  imports: [PrismaModule, NotificationModule, BudgetModule],
  controllers: [
    ItCategoryController,
    ItAssetController,
    ItDemandController,
    ItAttributionController,
    ItDashboardController,
  ],
  providers: [
    ItCategoryRepository,
    ItAssetRepository,
    ItDemandRepository,
    ItAttributionRepository,
    ItCategoryService,
    ItAssetService,
    ItDemandService,
    ItAttributionService,
    ItDepreciationService,
    ItTriggerDaService,
    ItDashboardService,
  ],
  exports: [ItAssetService, ItDemandService],
})
export class ParcInformatiqueModule {}
