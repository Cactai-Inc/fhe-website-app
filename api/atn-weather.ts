/* GET/POST /api/atn-weather — the daily rain-alert job (TASK-ATN Stage 4).
 *
 * For each org with ranch coordinates set, fetches the next two days' forecast
 * from Open-Meteo (free, no key) and, when a day's precipitation probability meets
 * the org's threshold AND that day has at least one booking, raises a `rain_today`
 * alert for every staff member. Idempotent per (day): a stored alert with source
 * 'rain_today' and category = the ISO day is upserted, so re-runs don't pile up.
 *
 * Auth: Vercel cron (x-vercel-cron) or Bearer CRON_SECRET for manual runs.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { authorizeCronRequest } from './_lib/cronAuth.js';

interface OrgRow { id: string; weather_lat: number | null; weather_lon: number | null; rain_alert_threshold: number }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authorizeCronRequest(req);
  if (req.method !== 'POST' && !(req.method === 'GET' && auth.isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!auth.ok) return res.status(401).json({ error: auth.reason ?? 'unauthorized' });

  const admin = getSupabaseAdmin();
  const { data: orgs, error: orgErr } = await admin
    .from('organizations')
    .select('id, weather_lat, weather_lon, rain_alert_threshold')
    .is('deleted_at', null)
    .not('weather_lat', 'is', null);
  if (orgErr) return res.status(500).json({ error: orgErr.message });

  let raised = 0;
  for (const org of (orgs ?? []) as OrgRow[]) {
    if (org.weather_lat == null || org.weather_lon == null) continue;
    // Open-Meteo: precipitation probability, next 2 days, ranch-local time.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${org.weather_lat}`
      + `&longitude=${org.weather_lon}&daily=precipitation_probability_max`
      + `&timezone=America%2FLos_Angeles&forecast_days=2`;
    let forecast: { daily?: { time?: string[]; precipitation_probability_max?: (number | null)[] } };
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      forecast = await r.json() as typeof forecast;
    } catch { continue; }

    const days = forecast.daily?.time ?? [];
    const probs = forecast.daily?.precipitation_probability_max ?? [];
    // staff recipients for this org
    const { data: staff } = await admin.rpc('org_staff_user_ids', { p_org_id: org.id });
    const staffIds = ((staff ?? []) as { user_id: string }[]).map((s) => s.user_id);
    if (staffIds.length === 0) continue;

    for (let i = 0; i < days.length; i += 1) {
      const day = days[i];
      const prob = probs[i];
      if (prob == null || prob < org.rain_alert_threshold) continue;
      // a booking that day (org-local)
      const { count } = await admin.from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .is('deleted_at', null)
        .neq('status', 'available')
        .gte('starts_at', `${day}T00:00:00`)
        .lte('starts_at', `${day}T23:59:59`);
      if (!count || count === 0) continue;

      for (const uid of staffIds) {
        // idempotent per (user, day): dedupe on source + category(day)
        const { data: existing } = await admin.from('alerts')
          .select('id').eq('user_id', uid).eq('source', 'rain_today')
          .eq('category', day).is('dismissed_at', null).limit(1);
        if (existing && existing.length > 0) continue;
        await admin.from('alerts').insert({
          org_id: org.id, user_id: uid,
          title: `Rain likely ${day} — sessions booked`,
          body: `${prob}% chance of precipitation on a day with outdoor sessions.`,
          link: '/app/calendar', severity: 'standard', source: 'rain_today', category: day,
        });
        raised += 1;
      }
    }
  }
  return res.status(200).json({ raised });
}
