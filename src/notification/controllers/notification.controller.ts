import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { NotificationRepository } from 'src/repository/notification/notification.repository';
import { GetNotificationsQueryDto } from '../dto/get-notifications-query.dto';

@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les notifications (paginées)' })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des notifications',
  })
  async getNotifications(@Query() query: GetNotificationsQueryDto) {
    return this.notificationRepository.findPaginated(query);
  }
}
