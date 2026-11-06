import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, Injectable } from '@nestjs/common';
import { SecuritySeverity } from '@prisma/client';
import type { Request, Response } from 'express';
import { SECURITY_EVENT_TYPES, SecurityEventsService } from './security-events.service.js';

export const FORBIDDEN_WINDOW_MS = 5 * 60 * 1000;
export const FORBIDDEN_THRESHOLD = 5;

/**
 * Compteur de refus 403 par compte, en fenêtre glissante de 5 minutes (M20).
 * Un seul événement par fenêtre : après un événement, le suivant n'est possible
 * qu'une fois la fenêtre écoulée.
 *
 * Dette (M20, étape 3.3) : compteur en mémoire du processus, remis à zéro au
 * redémarrage et non partagé entre instances.
 */
export class ForbiddenCounter {
  private readonly refusals = new Map<string, number[]>();
  private readonly lastEvent = new Map<string, number>();

  /** Enregistre un refus ; vrai si un événement `repeated_forbidden` doit être émis. */
  hit(userId: string, now = Date.now()): { emit: boolean; count: number } {
    const recent = (this.refusals.get(userId) ?? []).filter((at) => now - at < FORBIDDEN_WINDOW_MS);
    recent.push(now);
    this.refusals.set(userId, recent);
    const last = this.lastEvent.get(userId);
    const emit = recent.length >= FORBIDDEN_THRESHOLD && (last === undefined || now - last >= FORBIDDEN_WINDOW_MS);
    if (emit) this.lastEvent.set(userId, now);
    return { emit, count: recent.length };
  }
}

/**
 * Filtre global des 403 : compte les refus du compte connecté et écrit
 * `repeated_forbidden` (MEDIUM) au 5e refus de la fenêtre, puis renvoie le 403
 * standard, inchangé. Une panne d'écriture de l'événement n'altère pas la réponse.
 */
@Catch(ForbiddenException)
@Injectable()
export class ForbiddenAuditFilter implements ExceptionFilter {
  private readonly counter = new ForbiddenCounter();

  constructor(private readonly securityEvents: SecurityEventsService) {}

  async catch(exception: ForbiddenException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const user = request.user;
    if (user) {
      const { emit, count } = this.counter.hit(user.id);
      if (emit) {
        await this.securityEvents
          .record({
            eventType: SECURITY_EVENT_TYPES.REPEATED_FORBIDDEN,
            severity: SecuritySeverity.MEDIUM,
            source: 'rbac',
            description: `Le compte « ${user.username} » a reçu ${count} refus d'accès (403) en moins de 5 minutes.`,
            metadata: {
              userId: user.id,
              username: user.username,
              refusals: count,
              lastPath: request.path,
              lastMethod: request.method,
              sourceIp: request.ip ?? 'unknown',
            },
          })
          .catch(() => undefined);
      }
    }
    response.status(403).json(exception.getResponse());
  }
}
