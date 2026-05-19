import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from 'src/repository/user/user.repository';
import { PrismaModule } from 'prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
})
export class UserModule {}
