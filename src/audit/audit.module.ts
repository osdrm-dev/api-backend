import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { AuditService } from 'src/audit/services/audit.service';
import { AuditController } from './controllers/audit.controller';
import { AuditLogRepository } from 'src/repository/purchase';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository],
  exports: [AuditService, AuditLogRepository],
})
export class AuditModule {}
