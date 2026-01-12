import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTaskDto } from '../dto/create-task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TaskController {
  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'The task has been successfully created.',
    type: CreateTaskDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createTaskDto: CreateTaskDto) {
    // Logic to create a task
    return createTaskDto;
  }
}
