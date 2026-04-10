import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { logAudit, type AuditAction } from '../services/auditService';

/**
 * Log a page-view audit entry once on mount.
 * Replaces the duplicated useEffect+logAudit boilerplate across all pages.
 */
export function usePageAudit(action: AuditAction, detailKey: string): void {
  const { user } = useAuth();
  const logged = useRef(false);

  useEffect(() => {
    if (user && !logged.current) {
      logged.current = true;
      logAudit(user.username, action, detailKey);
    }
  }, [user, action, detailKey]);
}
