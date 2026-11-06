import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { inclusiveDateRange } from '../common/date-range.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditLogDto, AuthEventDto, Paginated, SecurityEventDto } from './dto/audit-response.dto.js';
import { ListAuditLogsQueryDto, ListAuthEventsQueryDto, ListSecurityEventsQueryDto } from './dto/audit-queries.dto.js';

const ACTOR = { select: { id: true, username: true } } as const;

/** Lecture seule des journaux (R26.2, R28) : aucune méthode d'écriture. */
@Injectable()
export class AuditReadService {
  constructor(private readonly prisma: PrismaService) {}

  async logs(query: ListAuditLogsQueryDto): Promise<Paginated<AuditLogDto>> {
    const { page, limit } = paging(query);
    const where: Prisma.AuditLogWhereInput = {
      timestamp: inclusiveDateRange(query.from, query.to),
      actorId: query.actorId,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      ...(query.action ? { action: query.action.endsWith('.') ? { startsWith: query.action } : query.action } : {}),
      ...(query.actor ? { actor: { username: { contains: query.actor.trim(), mode: 'insensitive' } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: ACTOR },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: rows.map(toAuditLogDto), total, page, limit };
  }

  async securityEvents(query: ListSecurityEventsQueryDto): Promise<Paginated<SecurityEventDto>> {
    const { page, limit } = paging(query);
    const where: Prisma.SecurityEventWhereInput = {
      timestamp: inclusiveDateRange(query.from, query.to),
      severity: query.severity,
      eventType: query.eventType,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.securityEvent.findMany({
        where,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.securityEvent.count({ where }),
    ]);
    return { data: rows.map(toSecurityEventDto), total, page, limit };
  }

  async authEvents(query: ListAuthEventsQueryDto): Promise<Paginated<AuthEventDto>> {
    const { page, limit } = paging(query);
    const where: Prisma.AuthEventWhereInput = {
      timestamp: inclusiveDateRange(query.from, query.to),
      userId: query.userId,
      eventType: query.eventType,
      ...(query.user ? { user: { is: { username: { contains: query.user.trim(), mode: 'insensitive' } } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.authEvent.findMany({
        where,
        include: { user: ACTOR },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.authEvent.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        user: row.user,
        authenticationMethod: row.authenticationMethod,
        eventType: row.eventType,
        sourceIp: row.sourceIp,
        timestamp: row.timestamp.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  /** Derniers audits, pour les dashboards SA et AUD. */
  async latestLogs(take = 5): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      include: { actor: ACTOR },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take,
    });
    return rows.map(toAuditLogDto);
  }

  /** Derniers événements de sécurité, éventuellement limités à certaines sévérités. */
  async latestSecurityEvents(take = 5, severities?: Prisma.EnumSecuritySeverityFilter['in']): Promise<SecurityEventDto[]> {
    const rows = await this.prisma.securityEvent.findMany({
      where: severities ? { severity: { in: severities } } : {},
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take,
    });
    return rows.map(toSecurityEventDto);
  }
}

function paging(query: { page?: number; limit?: number }) {
  return { page: query.page ?? 1, limit: query.limit ?? 25 };
}

function toAuditLogDto(row: Prisma.AuditLogGetPayload<{ include: { actor: typeof ACTOR } }>): AuditLogDto {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    oldValues: row.oldValues,
    newValues: row.newValues,
    sourceIp: row.sourceIp,
    timestamp: row.timestamp.toISOString(),
  };
}

function toSecurityEventDto(row: Prisma.SecurityEventGetPayload<object>): SecurityEventDto {
  return {
    id: row.id,
    eventType: row.eventType,
    severity: row.severity,
    source: row.source,
    description: row.description,
    metadata: row.metadata,
    timestamp: row.timestamp.toISOString(),
  };
}
