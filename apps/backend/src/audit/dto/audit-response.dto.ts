import type { AuthEventType, AuthProvider, Prisma, SecuritySeverity } from '@prisma/client';

export interface AuditLogDto {
  id: string;
  actor: { id: string; username: string };
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues: Prisma.JsonValue;
  newValues: Prisma.JsonValue;
  sourceIp: string;
  timestamp: string;
}

export interface SecurityEventDto {
  id: string;
  eventType: string;
  severity: SecuritySeverity;
  source: string;
  description: string;
  metadata: Prisma.JsonValue;
  timestamp: string;
}

export interface AuthEventDto {
  id: string;
  user: { id: string; username: string } | null;
  authenticationMethod: AuthProvider;
  eventType: AuthEventType;
  sourceIp: string;
  timestamp: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
