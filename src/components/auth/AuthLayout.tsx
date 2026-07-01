/**
 * Shared chrome for every auth screen (sign-in, register, forgot/reset password).
 * One home for the centered cream layout, the eyebrow/title header, and the white
 * form card — change it here and every auth page follows.
 */
import type { ReactNode } from 'react';

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="heading-section text-green-800">{title}</h1>
          {subtitle && <p className="body-text text-sm mt-2">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="text-center text-sm text-muted mt-6">{footer}</div>}
      </div>
    </div>
  );
}

/** The white form card used inside AuthLayout. */
export function AuthCard({ children, ...props }: { children: ReactNode } & React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form noValidate className="bg-white border border-green-800/10 p-8" {...props}>
      {children}
    </form>
  );
}
