import { useCallback, useState } from 'react';

/**
 * The idle → pending → success/error state machine every ops form uses.
 *
 * `run(...)` invokes the async fn, transitions status, stores the resolved
 * value or the thrown error, and RE-THROWS so callers can chain (e.g. close a
 * modal on success). Errors are never swallowed — they land on `state.error`
 * AND propagate.
 */
export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export interface UseAsyncResult<T, A extends unknown[]> extends AsyncState<T> {
  run: (...args: A) => Promise<T>;
  reset: () => void;
}

export function useAsync<T, A extends unknown[] = unknown[]>(
  fn: (...args: A) => Promise<T>,
): UseAsyncResult<T, A> {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (...args: A): Promise<T> => {
      setStatus('pending');
      setError(null);
      try {
        const result = await fn(...args);
        setData(result);
        setStatus('success');
        return result;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized);
        setStatus('error');
        throw normalized;
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  return {
    status,
    data,
    error,
    isIdle: status === 'idle',
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    run,
    reset,
  };
}
