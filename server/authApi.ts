/**
 * Auth API — thin aggregator (TECH-01 / F-09).
 *
 * Mounts the four sub-routers in the original top-to-bottom registration order
 * so every /api/auth/* route path, method, guard, and response shape is
 * byte-identical to the pre-refactor monolith.
 *
 * External contracts preserved:
 *   server/index.ts       imports { authApiRouter }   — unchanged
 *   server/settingsApi.ts imports { resetLimiter }    — re-exported here (AUTHCFG-04)
 *
 * Circular-import invariant (AUTHCFG-04): settingsApi → authApi → authHelpers
 * is the allowed chain. authHelpers does NOT import settingsApi at module top-level.
 */

import { Router } from 'express';

import { loginRouter } from './auth/loginApi.js';
import { sessionRouter } from './auth/sessionApi.js';
import { totpRouter } from './auth/totpApi.js';
import { userAdminRouter } from './auth/userAdminApi.js';

// Re-export resetLimiter so settingsApi's existing import keeps working without
// any change to settingsApi.ts (preserves AUTHCFG-04 — no new cycle).
export { resetLimiter } from './auth/authHelpers.js';

export const authApiRouter = Router();

// Mount order matches the original top-to-bottom registration order:
// login/verify/refresh/logout/config → users CRUD + password → totp → rotate-key + sessions
authApiRouter.use(loginRouter);
authApiRouter.use(userAdminRouter);
authApiRouter.use(totpRouter);
authApiRouter.use(sessionRouter);
