import { useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * A button that runs an async handler, disabling itself + showing a pending
 * label while in flight and surfacing the thrown error inline. Wraps the
 * useAsync contract inline so any slice gets pending/disabled/error for free.
 *
 * `onClick` MUST return a Promise (or void). Rejections are caught, rendered
 * (unless `onError` handles them), and NOT swallowed silently.
 */
export interface AsyncButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onError'> {
  onClick: () => Promise<unknown> | void;
  pendingLabel?: string;
  /** Called on rejection instead of rendering inline error text. */
  onError?: (error: Error) => void;
  children: ReactNode;
}

export function AsyncButton({
  onClick,
  pendingLabel,
  onError,
  children,
  disabled,
  className,
  type = 'button',
  ...rest
}: AsyncButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleClick = async () => {
    setPending(true);
    setError(null);
    try {
      await onClick();
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(toErrorMessage(err));
      if (onError) {
        onError(normalized);
      } else {
        setError(normalized);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type={type}
        className={className ?? 'btn-primary'}
        disabled={disabled || pending}
        aria-busy={pending}
        onClick={handleClick}
        {...rest}
      >
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {error && !onError && (
        <span role="alert" className="form-error">
          {error.message}
        </span>
      )}
    </span>
  );
}
