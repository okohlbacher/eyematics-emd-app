/**
 * Express Request type augmentation for custom properties added by server middleware.
 *
 * _capturedBody: Raw body string captured by readBody() in server/utils.ts.
 * Used by auditMiddleware as a fallback when req.body is not populated
 * (i.e., for non-auth mutation routes where express.json() is not mounted).
 *
 * Why 'express-serve-static-core': Express re-exports types from this package.
 * Augmenting this module ensures req._capturedBody is recognised on all Express
 * Request objects, including those typed via middleware function signatures.
 */
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Raw body string captured by readBody() for audit middleware consumption. */
    _capturedBody?: string;
  }
}
