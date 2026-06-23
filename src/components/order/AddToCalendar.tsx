import { CalendarPlus, Download } from 'lucide-react';
import {
  icsDataUri, googleCalendarUrl, outlookCalendarUrl, defaultLocation,
  type CalendarEvent,
} from '../../lib/calendar';

/** Small picker offering Google, Outlook, and an .ics download for a booked time. */
export default function AddToCalendar({
  title,
  start,
  end,
  description,
}: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
}) {
  const ev: CalendarEvent = { title, start, end, description, location: defaultLocation() };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <span className="inline-flex items-center gap-2 text-xs font-sans uppercase tracking-wide text-muted">
        <CalendarPlus size={14} aria-hidden="true" />
        Add to calendar
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" className="link-underline">
          Google
        </a>
        <a href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" className="link-underline">
          Outlook
        </a>
        <a href={icsDataUri(ev)} download="fhe-booking.ics" className="link-underline">
          <Download size={12} aria-hidden="true" />
          .ics
        </a>
      </div>
    </div>
  );
}
