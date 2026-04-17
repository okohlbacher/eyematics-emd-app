/**
 * Express Request type augmentation for _capturedBody.
 * The auth augmentation lives in authMiddleware.ts (F-17).
 */
declare global {
  namespace Express {
    interface Request {
      _capturedBody?: string;
    }
  }
}

export {};
