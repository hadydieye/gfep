import type { NotificationType } from '@prisma/client';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotificationsDto {
  data: NotificationDto[];
  total: number;
  page: number;
  limit: number;
}
