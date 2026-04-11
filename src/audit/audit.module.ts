import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from 'prisma/prisma.module';
import { AuditService } from 'src/audit/services/audit.service';
import { AuditController } from './controllers/audit.controller';
import { AuditLogRepository } from 'src/repository/purchase';
import { AuditLogProcessor } from './processors/audit-log.processor';
import { AUDIT_LOG_QUEUE } from './audit.constants';

@Module({
  imports: [BullModule.registerQueue({ name: AUDIT_LOG_QUEUE }), PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository, AuditLogProcessor],
  exports: [AuditService, AuditLogRepository],
})
export class AuditModule {}
