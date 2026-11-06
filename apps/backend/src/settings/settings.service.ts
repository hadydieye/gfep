import { Injectable, Optional } from '@nestjs/common';
import { createRequire } from 'module';
import { AdStatusService } from '../ad-auth/ad-status.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MAX_FAILED_LOGINS, LOCK_DURATION_MS } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

/** Clé de la durée de session dans system_settings. */
export const SESSION_TTL_HOURS_KEY = 'session.ttlHours';
/** Durée de session par défaut quand aucune ligne n'existe en base (C4). */
export const SESSION_TTL_HOURS_DEFAULT = 8;
/** Limite de téléchargement des documents (M10). */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
/** Formats acceptés (M10). */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export interface EffectiveConfiguration {
  sessionTtlHours: number;
  maxFailedLogins: number;
  lockDurationMs: number;
  loginRateLimit: { limit: number; windowMs: number };
  passwordChangeRateLimit: { limit: number; windowMs: number };
  maxUploadBytes: number;
  allowedMimeTypes: string[];
  adStatus: string;
  appVersion: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    // AdStatusService est disponible via AdAuthModule (global via AppModule)
    @Optional() private readonly adStatus: AdStatusService | null,
  ) {}

  /** Durée de session effective en heures (valeur en base ou défaut C4). */
  async getSessionTtlHours(): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: SESSION_TTL_HOURS_KEY } });
    if (!row) return SESSION_TTL_HOURS_DEFAULT;
    // La valeur JSON stockée est un entier
    const v = row.value;
    return typeof v === 'number' ? v : SESSION_TTL_HOURS_DEFAULT;
  }

  /** Configuration effective en lecture seule (GET /admin/settings). */
  async effectiveConfiguration(): Promise<EffectiveConfiguration> {
    const [sessionTtlHours, adStatusValue] = await Promise.all([
      this.getSessionTtlHours(),
      this.adStatus ? this.adStatus.status() : Promise.resolve('NOT_CONFIGURED' as const),
    ]);
    // Lire la version de l'application depuis package.json
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { version } = require('../../package.json') as { version: string };

    return {
      sessionTtlHours,
      maxFailedLogins: MAX_FAILED_LOGINS,
      lockDurationMs: LOCK_DURATION_MS,
      loginRateLimit: { limit: 5, windowMs: 900_000 },
      passwordChangeRateLimit: { limit: 5, windowMs: 900_000 },
      maxUploadBytes: MAX_UPLOAD_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      adStatus: adStatusValue,
      appVersion: version,
    };
  }

  /**
   * Met à jour la durée de session dans une transaction avec audit (N16).
   * La nouvelle durée s'applique aux sessions créées après la modification.
   */
  async update(
    dto: UpdateSettingsDto,
    actorId: string,
    sourceIp: string,
  ): Promise<EffectiveConfiguration> {
    const previous = await this.getSessionTtlHours();

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: SESSION_TTL_HOURS_KEY },
        update: { value: dto.sessionTtlHours, updatedById: actorId },
        create: { key: SESSION_TTL_HOURS_KEY, value: dto.sessionTtlHours, updatedById: actorId },
      });
      await this.audit.record(tx, {
        actorId,
        action: 'setting.update',
        resourceType: 'SystemSetting',
        resourceId: SESSION_TTL_HOURS_KEY,
        oldValues: { sessionTtlHours: previous },
        newValues: { sessionTtlHours: dto.sessionTtlHours },
        sourceIp,
      });
    });

    return this.effectiveConfiguration();
  }
}
