import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../state/sync';

/**
 * Re-runs `loader` whenever the global data version changes (after a local write
 * or a sync). This is the mobile analogue of the web's react-query invalidation,
 * but backed by the local SQLite mirror so it works fully offline.
 */
export function useLocalQuery<T>(loader: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  loading: boolean;
  reload: () => void;
} {
  const { dataVersion } = useSync();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((d) => {
        if (alive) setData(d);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, tick, ...deps]);

  return { data, loading, reload };
}
