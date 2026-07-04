import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Always call the latest onClose without re-running the history effect.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  // Make the phone/browser Back button close the modal instead of navigating away:
  // push a same-URL history entry on open; Back pops it and fires popstate.
  useEffect(() => {
    window.history.pushState({ armoryModal: true }, '');
    let closedByBack = false;
    const onPop = (e: PopStateEvent) => {
      // If our own entry is still on top, a child overlay (e.g. the image
      // lightbox) was popped — stay open and let it handle the Back.
      if ((e.state as { armoryModal?: boolean } | null)?.armoryModal) return;
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed via UI (Cancel/backdrop/save): consume the entry we added —
      // but only if it's still ours (guard against an intervening navigation).
      const state = window.history.state as { armoryModal?: boolean } | null;
      if (!closedByBack && state?.armoryModal) {
        window.history.back();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
          <h2 className="font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
