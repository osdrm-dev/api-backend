import { Module } from '@nestjs/common';
import { UserRepository } from '../../purchaseValidation/repositories/user.repository';

@Module({
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
