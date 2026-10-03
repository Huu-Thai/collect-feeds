import { SetMetadata } from '@nestjs/common';

export const IS_SELF_SERVICE_KEY = 'isSelfService';

/**
 * Any authenticated user may call this route — no role permission needed. For endpoints that
 * only ever return or act on the caller's own data (e.g. GET /auth/me).
 */
export const SelfService = () => SetMetadata(IS_SELF_SERVICE_KEY, true);
