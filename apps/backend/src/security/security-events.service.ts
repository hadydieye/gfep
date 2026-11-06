import { Injectable } from '@nestjs/common';
import { Prisma, SecuritySeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/** Types d'événements de sécurité écrits par l'application (M20). */
export const SECURITY_EVENT_TYPES = {
  ACCOUNT_LOCKED: 'account_locked',
  REPEATED_FORBIDDEN: 'repeated_forbidden',
  // Câblé à l'étape 2.7 (LDAP injoignable, sévérité HIGH)
  AD_UNREACHABLE: 'ad_unreachable',
} as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[keyof typeof SECURITY_EVENT_TYPES];

export interface SecurityEventEntry {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  /** Composant émetteur, ex. `auth`, `rbac`, `ad-auth` */
  source: string;
  description: string;
  /** Contexte non secret (identifiants, IP, compteurs) ; jamais de mot de passe ni de jeton */
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class SecurityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Écrit l'événement, dans la transaction fournie quand l'action est transactionnelle. */
  record(entry: SecurityEventEntry, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    return client.securityEvent.create({
      data: {
        eventType: entry.eventType,
        severity: entry.severity,
        source: entry.source,
        description: entry.description,
        metadata: entry.metadata,
      },
    });
  }
}
