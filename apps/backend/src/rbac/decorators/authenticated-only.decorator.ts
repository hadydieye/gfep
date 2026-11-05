import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/**
 * Exception explicite à l'interdiction par défaut : route ouverte à tout
 * utilisateur authentifié, quel que soit son rôle, et limitée à ses propres
 * données (ex. /auth/me, /auth/logout).
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);
