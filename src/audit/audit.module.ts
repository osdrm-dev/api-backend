import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { AuditService } from 'src/audit/services/audit.service';
import { AuditRepository } from 'src/repository/audit/audit.repository';
import { AuditController } from './controllers/audit.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
