import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limitation par compte (N14) : le traceur est l'identifiant du compte connecté
 * (posé par SessionMiddleware, la route n'étant jamais publique), et non l'IP.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | null | undefined;
    return user?.id ? `user:${user.id}` : String(req.ip ?? 'unknown');
  }
}
