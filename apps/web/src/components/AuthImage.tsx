import { useEffect, useState } from 'react';
import { fetchImageObjectUrl } from '../lib/api';

/** Loads a protected image via fetch (carrying the auth header) into an object URL. */
export function AuthImage({
  filename,
  alt,
  className,
}: {
  filename: string;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    fetchImageObjectUrl(filename)
      .then((u) => {
        if (active) {
          objectUrl = u;
          setUrl(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filename]);

  if (!url) {
    return <div className={`animate-pulse bg-neutral-200 dark:bg-neutral-800 ${className ?? ''}`} />;
  }
  return <img src={url} alt={alt ?? ''} className={className} />;
}
