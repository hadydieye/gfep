import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { ALL_ROLES } from '../rbac/roles.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import type { NotificationDto, PaginatedNotificationsDto } from './dto/notification-response.dto.js';
import { NotificationsService } from './notifications.service.js';

// Les 8 rôles, @Roles + @Permission (M24 : @AuthenticatedOnly reste réservé à /auth/me et /auth/logout)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @Permission('notifications', 'read')
  findAll(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedNotificationsDto> {
    return this.notificationsService.findAll(query, user);
  }

  @Get('unread-count')
  @Roles(...ALL_ROLES)
  @Permission('notifications', 'read')
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    return this.notificationsService.unreadCount(user);
  }

  @Patch(':id/read')
  @Roles(...ALL_ROLES)
  @Permission('notifications', 'update')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationDto> {
    return this.notificationsService.markRead(id, user);
  }

  @Post('read-all')
  @HttpCode(200)
  @Roles(...ALL_ROLES)
  @Permission('notifications', 'update')
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user);
  }
}
