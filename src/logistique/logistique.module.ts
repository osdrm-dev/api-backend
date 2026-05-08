import { Module } from '@nestjs/common';
import { ParcAutoModule } from './parc-auto/parc-auto.module';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { ParcInformatiqueModule } from './parc-informatique/parc-informatique.module';
import { BauxModule } from './baux/baux.module';
import { DeplacementModule } from './deplacement/deplacement.module';

@Module({
  imports: [
    ParcAutoModule,
    MaintenanceModule,
    ParcInformatiqueModule,
    BauxModule,
    DeplacementModule,
  ],
  exports: [
    ParcAutoModule,
    MaintenanceModule,
    ParcInformatiqueModule,
    BauxModule,
    DeplacementModule,
  ],
})
export class LogistiqueModule {}
