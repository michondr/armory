import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchImageObjectUrl } from './api';

interface LightboxState {
  open: (filename: string) => void;
}

// Default no-op so AuthImage can call useLightbox() even if a provider isn't mounted.
const LightboxContext = createContext<LightboxState>({ open: () => undefined });

export const useLightbox = (): LightboxState => useContext(LightboxContext);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [filename, setFilename] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) {
      setUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
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

  useEffect(() => {
    if (!filename) return;
    // Push a history entry so the phone Back button closes the lightbox first.
    window.history.pushState({ armoryLightbox: true }, '');
    let closedByBack = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilename(null);
    };
    const onPop = () => {
      closedByBack = true;
      setFilename(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = '';
      const state = window.history.state as { armoryLightbox?: boolean } | null;
      if (!closedByBack && state?.armoryLightbox) window.history.back();
    };
  }, [filename]);

  return (
    <LightboxContext.Provider value={{ open: setFilename }}>
      {children}
      {filename && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFilename(null)}
        >
          {url ? (
            <img
              src={url}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-white">Loading…</span>
          )}
          <button
            onClick={() => setFilename(null)}
            className="absolute right-4 top-4 text-3xl leading-none text-white/80 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </LightboxContext.Provider>
  );
}
