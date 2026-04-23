import { useEffect, useState } from 'react';

import { authFetch } from '../services/authHeaders';

interface AuthImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  fallbackSrc?: string;
}

const TRANSPARENT_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** <img> wrapper that fetches authenticated endpoints (e.g. /api/fhir/images/*)
 *  via authFetch and renders the resulting blob. Native <img> elements cannot
 *  carry the Bearer token, so any direct src that hits an auth-gated route
 *  returns 401. */
export default function AuthImg({ src, fallbackSrc, alt, onError, ...rest }: AuthImgProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setFailed(false);
    setBlobUrl(null);

    (async () => {
      try {
        const resp = await authFetch(src);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  const effectiveSrc = failed ? (fallbackSrc ?? TRANSPARENT_GIF) : (blobUrl ?? TRANSPARENT_GIF);

  return (
    <img
      {...rest}
      src={effectiveSrc}
      alt={alt}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}
