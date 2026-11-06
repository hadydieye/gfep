import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SUPER_ADMIN } from '../rbac/roles.js';
import { CreateAdMappingDto } from './dto/create-ad-mapping.dto.js';

export interface AdMappingDto {
  id: string;
  adGroupDn: string;
  role: { id: string; name: string };
}

/**
 * Mappings groupe AD → rôle (M22). Seul un SUPER_ADMIN crée ou supprime un mapping
 * vers le rôle SUPER_ADMIN. Chaque changement est audité.
 * TODO(AD-REVISION) : groupes de production et imbrication de groupes à définir.
 */
@Injectable()
export class AdMappingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<AdMappingDto[]> {
    const mappings = await this.prisma.adGroupRoleMapping.findMany({
      include: { role: { select: { id: true, name: true } } },
      orderBy: { adGroupDn: 'asc' },
    });
    return mappings.map(({ id, adGroupDn, role }) => ({ id, adGroupDn, role }));
  }

  async create(dto: CreateAdMappingDto, actor: AuthenticatedUser, sourceIp: string): Promise<AdMappingDto> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BusinessRuleException('Rôle inexistant.');
    if (role.name === SUPER_ADMIN && !actor.roles.includes(SUPER_ADMIN)) throw new ForbiddenException();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const mapping = await tx.adGroupRoleMapping.create({ data: { adGroupDn: dto.adGroupDn, roleId: role.id } });
        await this.audit.record(tx, {
          actorId: actor.id,
          action: 'ad_mapping.create',
          resourceType: 'AdGroupRoleMapping',
          resourceId: mapping.id,
          sourceIp,
          newValues: { adGroupDn: mapping.adGroupDn, role: role.name },
        });
        return { id: mapping.id, adGroupDn: mapping.adGroupDn, role: { id: role.id, name: role.name } };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce groupe est déjà associé à un rôle.');
      }
      throw error;
    }
  }

  async remove(id: string, actor: AuthenticatedUser, sourceIp: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const mapping = await tx.adGroupRoleMapping.findUnique({ where: { id }, include: { role: true } });
      if (!mapping) throw new NotFoundException('Mapping introuvable.');
      if (mapping.role.name === SUPER_ADMIN && !actor.roles.includes(SUPER_ADMIN)) throw new ForbiddenException();
      await tx.adGroupRoleMapping.delete({ where: { id } });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'ad_mapping.delete',
        resourceType: 'AdGroupRoleMapping',
        resourceId: id,
        sourceIp,
        oldValues: { adGroupDn: mapping.adGroupDn, role: mapping.role.name },
      });
    });
  }
}
