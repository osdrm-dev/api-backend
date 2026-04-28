import { Module } from '@nestjs/common';
import { ParcAutoModule } from './parc-auto/parc-auto.module';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { ParcInformatiqueModule } from './parc-informatique/parc-informatique.module';

@Module({
  imports: [ParcAutoModule, MaintenanceModule, ParcInformatiqueModule],
  exports: [ParcAutoModule, MaintenanceModule, ParcInformatiqueModule],
})
export class LogistiqueModule {}
