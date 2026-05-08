import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BauxIndexationService } from '../services/baux-indexation.service';

@Injectable()
export class BailIndexationCron {
  private readonly logger = new Logger(BailIndexationCron.name);

  constructor(private readonly indexationService: BauxIndexationService) {}

  @Cron('0 7 1 * *')
  async handleIndexation(): Promise<void> {
    this.logger.log('[BAUX INDEXATION] Déclenchement indexation mensuelle...');
    const currentMonth = new Date().getMonth() + 1;
    await this.indexationService.applyIndexation(currentMonth);
    this.logger.log('[BAUX INDEXATION] Indexation mensuelle terminée.');
  }
}
