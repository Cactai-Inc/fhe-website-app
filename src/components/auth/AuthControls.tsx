/**
 * Reusable auth form controls — the single home for the field, error/notice, and
 * submit-button styling shared across every auth screen.
 */
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

export function AuthField({
  id,
  label,
  hint,
  ...input
}: {
  id: string;
  label: string;
  hint?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-5">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input id={id} className="form-input" {...input} />
      {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-4 py-3 mb-5">
      {children}
    </div>
  );
}

/** Neutral/positive confirmation (e.g. "check your email"). */
export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div className="bg-green-50 border border-green-800/15 text-green-800 text-sm font-sans px-4 py-3 mb-5">
      {children}
    </div>
  );
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  ...props
}: {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" disabled={loading} className="btn-primary w-full justify-center" {...props}>
      {loading ? (loadingLabel ?? 'Working…') : children}
      {!loading && <ArrowRight size={16} />}
    </button>
  );
}

export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-4 my-6" aria-hidden="true">
      <span className="h-px flex-1 bg-green-800/10" />
      <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
      <span className="h-px flex-1 bg-green-800/10" />
    </div>
  );
}
