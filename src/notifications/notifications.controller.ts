import { Controller, Get, Patch, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiCookieAuth('fffa_session')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of notifications and unread count' })
  @Get()
  async getAll(@Req() req: any) {
    const [notifications, unreadCount] = await Promise.all([
      this.notifService.findByUser(req.user.userId),
      this.notifService.unreadCount(req.user.userId),
    ]);
    return { notifications, unreadCount };
  }

  @ApiOperation({ summary: 'Mark a single notification as read' })
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    await this.notifService.markRead(id, req.user.userId);
    return { success: true };
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Post('read-all')
  async markAllRead(@Req() req: any) {
    await this.notifService.markAllRead(req.user.userId);
    return { success: true };
  }
}
