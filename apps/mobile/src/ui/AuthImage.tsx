import { Image, type ImageContentFit } from 'expo-image';
import type { ImageStyle } from 'react-native';
import { authHeaders, imageUrl } from '../lib/api';
import { isLocalUri } from '../sync/images';

/**
 * Renders a protected (JWT-gated) image, or a not-yet-uploaded local capture.
 *
 * The server serves images behind `JwtAuthGuard`, so remote fetches must carry
 * the `Authorization` header. React Native's core `<Image>` drops `source.headers`
 * on Android for a single-object source (its native `setSource` reads only `uri`),
 * which silently 401'd every image. `expo-image` reads `source.headers` natively
 * on both platforms, so this is the component all authed images go through.
 *
 * `path` is either a bare server filename (post-sync) or a local `file:///`/`content://`
 * URI (captured, pre-upload). Local URIs need no auth.
 */
export function AuthImage({
  path,
  style,
  contentFit = 'cover',
  onError,
  onLoad,
}: {
  path: string | null | undefined;
  style?: ImageStyle;
  contentFit?: ImageContentFit;
  onError?: (message: string) => void;
  /** Reports the image's intrinsic pixel dimensions once decoded. */
  onLoad?: (dims: { width: number; height: number }) => void;
}) {
  if (!path) return null;

  const source = isLocalUri(path)
    ? { uri: path }
    : { uri: imageUrl(path), headers: authHeaders() };

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      transition={150}
      cachePolicy="memory-disk"
      onError={(e) => onError?.(e.error)}
      onLoad={(e) => {
        const src = e.source;
        if (src?.width && src?.height) onLoad?.({ width: src.width, height: src.height });
      }}
    />
  );
}