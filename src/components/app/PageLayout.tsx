import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

/**
 * PAGE LAYOUT — uniform header, page-specific content.
 *
 * Owner, 2026-08-08: "make a page layout template for uniformity of the header,
 * then unique content layouts based on the page content."
 *
 * So this owns exactly two things and no more: the page's outer rhythm (the gap
 * beneath the app header, the gutters, the reading-width cap) and the header
 * itself. Everything below `children` is the page's own business — this must not
 * grow opinions about content layout, because the moment it does, every page
 * starts fighting it and they drift apart again, which is the problem it was
 * built to end.
 *
 * `width` exists because content genuinely differs: a form wants a narrow
 * column, a table wants room. The HEADER stays inside the same cap so the page
 * name and the `+` sit on the same gutter as the content beneath them.
 */
const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-4xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
} as const;

export function PageLayout({
  name, title, description, onAdd, addLabel,
  width = 'default', children,
}: {
  name: string;
  title?: string;
  description?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  return (
    /* py-8 is the gap the owner asked for "starting from the header and working
       down the page" — the app header is sticky and flush, so without it the
       page name would sit against the header's bottom edge. */
    <div className={`${WIDTHS[width]} mx-auto px-4 sm:px-6 py-8`}>
      <PageHeader
        name={name}
        title={title}
        description={description}
        onAdd={onAdd}
        addLabel={addLabel}
      />
      {children}
    </div>
  );
}
