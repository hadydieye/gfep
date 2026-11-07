import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../auth/authenticated-user.js';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { Permission } from '../../../rbac/decorators/permission.decorator.js';
import { Roles } from '../../../rbac/decorators/roles.decorator.js';
import { READ_ROLES } from '../../../rbac/roles.js';
import { LabLoggerService } from '../../lab-logger.service.js';
import { Web01Service } from './web01.service.js';

/**
 * WEB-01 — SQL Injection (T-WEB01-1).
 *
 * Route : GET /api/v1/lab/employees/search?q=<payload>
 *
 * Préfixe /lab/ pour éviter le conflit avec GET /employees/:id (ParseUUIDPipe).
 * Guards RBAC intacts : @Roles(...READ_ROLES) + @Permission('employees', 'read').
 * La faille est dans le service : concaténation directe dans $queryRawUnsafe.
 */
@Controller('lab/employees')
export class Web01Controller {
  constructor(
    private readonly web01Service: Web01Service,
    private readonly labLogger: LabLoggerService,
  ) {}

  @Get('search')
  @Roles(...READ_ROLES)
  @Permission('employees', 'read')
  async search(
    @Query('q') q: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<unknown[]> {
    const results = await this.web01Service.search(q ?? '');
    this.labLogger.log({
      scenarioCode: 'WEB-01',
      actorId: user.id,
      sourceIp: req.ip ?? '',
      result: 'exploited',
    });
    return results;
  }
}
