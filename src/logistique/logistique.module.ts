import { Module } from '@nestjs/common';
import { ParcAutoModule } from './parc-auto/parc-auto.module';
import { MaintenanceModule } from 'src/maintenance/maintenance.module';
import { InventoryModule } from './inventory/inventory.module';
import { BauxModule } from './baux/baux.module';
import { MissionModule } from './mission/mission.module';
import { TripModule } from './trip/trip.module';
import { CarburantModule } from './carburant/carburant.module';

@Module({
  imports: [
    ParcAutoModule,
    MaintenanceModule,
    InventoryModule,
    BauxModule,
    MissionModule,
    TripModule,
    CarburantModule,
  ],
  exports: [
    ParcAutoModule,
    MaintenanceModule,
    InventoryModule,
    BauxModule,
    MissionModule,
    TripModule,
    CarburantModule,
  ],
})
export class LogistiqueModule {}
