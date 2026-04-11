import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuditLogRepository } from 'src/repository/purchase';
import { AUDIT_LOG_QUEUE, AUDIT_LOG_JOB } from '../audit.constants';

@Processor(AUDIT_LOG_QUEUE)
export class AuditLogProcessor extends WorkerHost {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== AUDIT_LOG_JOB) return;
    await this.auditLogRepository.log(job.data);
  }
}
