import { useCallback, useState } from 'react';

/**
 * Minimal, dependency-free toast state. A slice renders `toasts` and calls
 * `push`/`success`/`error` from its handlers; `dismiss` removes one by id.
 * No portals, no global singleton — just local state a layout can render.
 */
export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

export interface UseToastResult {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => string;
  success: (message: string) => string;
  error: (message: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast-${counter}`;
}

export function useToast(): UseToastResult {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info'): string => {
    const id = nextId();
    setToasts((prev) => [...prev, { id, tone, message }]);
    return id;
  }, []);

  const success = useCallback((message: string) => push(message, 'success'), [push]);
  const error = useCallback((message: string) => push(message, 'error'), [push]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  return { toasts, push, success, error, dismiss, clear };
}
