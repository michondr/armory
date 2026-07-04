import { useEffect, useState } from 'react';
import { fetchImageObjectUrl } from '../lib/api';
import { useLightbox } from '../lib/lightbox';

/** Loads a protected image via fetch (carrying the auth header) into an object URL. */
export function AuthImage({
  filename,
  alt,
  className,
  zoomable,
}: {
  filename: string;
  alt?: string;
  className?: string;
  /** When true, clicking opens the image full-size in a lightbox. */
  zoomable?: boolean;
}) {
  const { open } = useLightbox();
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
  return (
    <img
      src={url}
      alt={alt ?? ''}
      className={`${className ?? ''}${zoomable ? ' cursor-zoom-in' : ''}`}
      onClick={zoomable ? () => open(filename) : undefined}
    />
  );
}
