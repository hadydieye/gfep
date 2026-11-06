import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { AUDIT_ROLES } from '../rbac/roles.js';
import { AuditReadService } from './audit-read.service.js';
import type { AuditLogDto, AuthEventDto, Paginated, SecurityEventDto } from './dto/audit-response.dto.js';
import { ListAuditLogsQueryDto, ListAuthEventsQueryDto, ListSecurityEventsQueryDto } from './dto/audit-queries.dto.js';

/**
 * Journaux immuables (M12, R26.2) : uniquement des routes GET. SUPER_ADMIN et
 * AUDITOR ; l'IT_ADMINISTRATOR n'y a pas accès (M21).
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly auditRead: AuditReadService) {}

  @Get('logs')
  @Roles(...AUDIT_ROLES)
  @Permission('audit', 'read')
  logs(@Query() query: ListAuditLogsQueryDto): Promise<Paginated<AuditLogDto>> {
    return this.auditRead.logs(query);
  }

  @Get('security-events')
  @Roles(...AUDIT_ROLES)
  @Permission('security_events', 'read')
  securityEvents(@Query() query: ListSecurityEventsQueryDto): Promise<Paginated<SecurityEventDto>> {
    return this.auditRead.securityEvents(query);
  }

  @Get('auth-events')
  @Roles(...AUDIT_ROLES)
  @Permission('audit', 'read')
  authEvents(@Query() query: ListAuthEventsQueryDto): Promise<Paginated<AuthEventDto>> {
    return this.auditRead.authEvents(query);
  }
}
