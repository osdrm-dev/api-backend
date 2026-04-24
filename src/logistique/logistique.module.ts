import { Module } from '@nestjs/common';
import { ParcAutoModule } from './parc-auto/parc-auto.module';

@Module({
  imports: [ParcAutoModule],
  exports: [ParcAutoModule],
})
export class LogistiqueModule {}
