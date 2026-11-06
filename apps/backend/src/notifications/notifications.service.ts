import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import type { Notification } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationDto, PaginatedNotificationsDto } from './dto/notification-response.dto.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
}

/**
 * Notifications in-app (M19). `notify` écrit dans la transaction de l'action qui
 * déclenche la notification ; la lecture est toujours limitée au destinataire :
 * la notification d'un autre utilisateur est traitée comme inexistante (404).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    tx: Prisma.TransactionClient,
    userIds: readonly string[],
    payload: NotificationPayload,
  ): Promise<number> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return 0;
    const { count } = await tx.notification.createMany({
      data: recipients.map((userId) => ({ userId, ...payload })),
    });
    return count;
  }

  async findAll(query: ListNotificationsQueryDto, user: AuthenticatedUser): Promise<PaginatedNotificationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.status === 'read' ? { readAt: { not: null } } : {}),
      ...(query.status === 'unread' ? { readAt: null } : {}),
    };
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data: notifications.map(toDto), total, page, limit };
  }

  async unreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    return { count: await this.prisma.notification.count({ where: { userId: user.id, readAt: null } }) };
  }

  /** Idempotent : une notification déjà lue garde sa date de lecture. */
  async markRead(id: string, user: AuthenticatedUser): Promise<NotificationDto> {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    const notification = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!notification) throw new NotFoundException('Notification introuvable.');
    return toDto(notification);
  }

  async markAllRead(user: AuthenticatedUser): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  /** 5 dernières notifications de l'utilisateur (carte « Mes notifications »). */
  async latest(userId: string, take = 5): Promise<NotificationDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
    return notifications.map(toDto);
  }
}

function toDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}
