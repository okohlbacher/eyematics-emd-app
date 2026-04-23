/**
 * Express Request type augmentation for _capturedBody.
 * The auth augmentation lives in authMiddleware.ts (F-17).
 *
 * retained: ambient global module augmentation consumed by auditMiddleware.ts
 * (reads req._capturedBody) and auditMiddleware.test.ts (mocks the field).
 * knip reports this file as unused because it exports no values; TypeScript
 * loads it via tsconfig include and the augmentation is picked up at compile
 * time. Deleting it breaks the Request typing for _capturedBody.
 */
declare global {
  namespace Express {
    interface Request {
      _capturedBody?: string;
    }
  }
}

export {};
