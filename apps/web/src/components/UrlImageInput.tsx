import { useState } from 'react';
import { ApiError, uploadImageFromUrl } from '../lib/api';
import { Button, Input } from './ui';

/** Paste an image URL; the server fetches + stores it and returns the filename. */
export function UrlImageInput({ onAdded }: { onAdded: (filename: string) => void | Promise<void> }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const { imagePath } = await uploadImageFromUrl(value);
      await onAdded(imagePath);
      setUrl('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add image from URL');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          type="url"
          placeholder="…or paste an image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
        />
        <Button type="button" variant="ghost" onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add URL'}
        </Button>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
