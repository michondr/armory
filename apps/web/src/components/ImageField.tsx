import { useRef, useState } from 'react';
import { uploadImage } from '../lib/api';
import { AuthImage } from './AuthImage';
import { UrlImageInput } from './UrlImageInput';
import { Button } from './ui';

/** Single-image picker: preview + upload + paste-URL + clear. Value is the stored filename. */
export function ImageField({
  value,
  onChange,
  placeholder = '📷',
}: {
  value: string | null;
  onChange: (filename: string | null) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { imagePath } = await uploadImage(file);
      onChange(imagePath);
    } catch {
      setError('Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <AuthImage filename={value} className="h-20 w-20 rounded-lg object-cover" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-lg bg-neutral-200 text-2xl text-neutral-400 dark:bg-neutral-800">
            {placeholder}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFile}
          className="hidden"
        />
        <div className="flex flex-col gap-1">
          <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      </div>
      <UrlImageInput onAdded={(filename) => onChange(filename)} />
    </div>
  );
}
