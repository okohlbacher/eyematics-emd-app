/**
 * Page-view audit hook — now a no-op.
 * All audit logging is handled server-side by auditMiddleware.
 * Kept as a stub so existing page imports don't break.
 */
export function usePageAudit(_action: string, _detailKey: string): void {
  // Server-side audit middleware automatically logs all /api/* requests.
}
