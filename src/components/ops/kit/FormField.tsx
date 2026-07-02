import { useId } from 'react';
import type { ReactElement } from 'react';

/**
 * Label + control + error wrapper for the ops forms. Wraps a single control
 * (passed as `children` via a render prop that receives the generated id and
 * error-state class) so every field gets a linked label, the required marker,
 * optional hint, and error text driven by `.form-error` / `.form-input-error`.
 */
export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  /** Render prop: receives the input id + a class to merge onto the control. */
  children: (args: { id: string; describedBy?: string; errorClass: string }) => ReactElement;
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const errorClass = error ? 'form-input-error' : '';

  return (
    <div className="mb-4">
      <label htmlFor={id} className="form-label">
        {label}
        {required && (
          <span className="text-red-700 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, errorClass })}
      {hint && !error && (
        <p id={hintId} className="form-hint mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
