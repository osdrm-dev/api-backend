import { Module } from '@nestjs/common';
import { TaskController } from './controller/task.controller';

@Module({
  controllers: [TaskController],
})
export class TaskModule {}
