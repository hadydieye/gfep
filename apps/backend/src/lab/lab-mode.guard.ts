import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

/**
 * Défense en profondeur (R-LAB-2) : même si LabModule n'est importé que quand
 * LAB_MODE=true, ce guard rejette toute requête si la variable a changé en
 * cours de vie du processus. Ne doit jamais lever d'erreur — juste 403.
 */
@Injectable()
export class LabModeGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.LAB_MODE !== 'true') {
      throw new ForbiddenException('LAB_MODE is not enabled.');
    }
    return true;
  }
}
