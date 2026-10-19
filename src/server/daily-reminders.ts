import { buildDigest, type FamilyFinanceData } from '../app/domain';

/**
 * Daily email job. Runs on Supabase as an Edge Function (see docs/REMINDERS_SETUP.md); kept as plain
 * functions here so it is tested like the rest of the code. `npm run build:function` bundles it, with the
 * same renewal rules the app uses, into supabase/functions/daily-reminders/index.ts.
 */
export interface ReminderEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  REMINDER_TO?: string;
  REMINDER_FROM?: string;
  APP_URL?: string;
}

type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Today's date in India, whatever timezone the server runs in. */
export function todayInIndia(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

export async function handleReminderRequest(request: Request, env: ReminderEnv, fetchFn: FetchLike, now = new Date()): Promise<Response> {
  if (!env.CRON_SECRET || request.headers.get('x-cron-secret') !== env.CRON_SECRET) return json(401, { error: 'Unauthorized' });

  const missing = (['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'REMINDER_TO'] as const).filter((k) => !env[k]);
  if (missing.length > 0) return json(500, { error: `Missing settings: ${missing.join(', ')}` });

  const read = await fetchFn(`${env.SUPABASE_URL}/rest/v1/family_snapshot?id=eq.main&select=data`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!read.ok) return json(502, { error: `Could not read the shared copy (${read.status})` });
  const rows = (await read.json()) as Array<{ data: FamilyFinanceData }>;
  const data = rows[0]?.data;
  if (!data) return json(200, { sent: false, reason: 'No shared copy yet' });

  const digest = buildDigest(data, todayInIndia(now), env.APP_URL);
  if (!digest) return json(200, { sent: false, reason: 'Nothing needs action' });

  const to = env.REMINDER_TO!.split(',').map((s) => s.trim()).filter(Boolean);
  const send = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.REMINDER_FROM || 'Family Finance <onboarding@resend.dev>',
      to,
      subject: digest.subject,
      text: digest.text,
      html: digest.html,
    }),
  });
  if (!send.ok) return json(502, { error: `Email provider refused the message (${send.status})`, detail: (await send.text()).slice(0, 300) });
  return json(200, { sent: true, items: digest.items.length, to: to.length });
}

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void; env: { toObject(): ReminderEnv } } | undefined;
if (typeof Deno !== 'undefined') {
  Deno.serve((request) => handleReminderRequest(request, Deno!.env.toObject(), fetch as unknown as FetchLike));
}
