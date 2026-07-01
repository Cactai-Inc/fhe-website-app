/* Add-to-calendar helpers. The app builds these from a booking's date/time/title
 * — no calendar integration required. The same .ics is attached to the
 * confirmation email server-side.
 */

import { BRAND } from './brand';

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}

function fmtUtc(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(ev: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//French Heritage Equestrian//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${fmtUtc(ev.start)}-${Math.abs(hashCode(ev.title))}@frenchheritagequestrian.com`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(ev.start)}`,
    `DTEND:${fmtUtc(ev.end)}`,
    `SUMMARY:${escapeText(ev.title)}`,
    ev.description ? `DESCRIPTION:${escapeText(ev.description)}` : '',
    ev.location ? `LOCATION:${escapeText(ev.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function icsDataUri(ev: CalendarEvent): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(ev))}`;
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${fmtUtc(ev.start)}/${fmtUtc(ev.end)}`,
    details: ev.description ?? '',
    location: ev.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    startdt: ev.start.toISOString(),
    enddt: ev.end.toISOString(),
    body: ev.description ?? '',
    location: ev.location ?? '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function defaultLocation(): string {
  return `${BRAND.name}, Carmel Creek Ranch, San Diego, CA`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
