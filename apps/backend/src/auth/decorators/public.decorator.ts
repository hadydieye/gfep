import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans session. Réservé à /health et /auth/login. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
