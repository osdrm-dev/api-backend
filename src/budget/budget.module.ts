import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { FileStorageModule } from 'src/storage/file.module';

import { BudgetTableController } from './controllers/budget-table.controller';
import { BudgetTableService } from './services/budget-table.service';
import { BudgetTableRepository } from './repository/budget-table.repository';
import { CsvParserService } from './services/csv-parser.service';
import { BudgetDiffService } from './services/budget-diff.service';

@Module({
  imports: [PrismaModule, FileStorageModule],
  controllers: [BudgetTableController],
  providers: [
    BudgetTableService,
    BudgetTableRepository,
    CsvParserService,
    BudgetDiffService,
  ],
  exports: [BudgetTableService],
})
export class BudgetModule {}
