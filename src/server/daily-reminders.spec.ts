import { createSeedData } from '../app/domain';
import { handleReminderRequest, todayInIndia, type ReminderEnv } from './daily-reminders';

const env: ReminderEnv = {
  SUPABASE_URL: 'https://p.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  CRON_SECRET: 's3cret',
  RESEND_API_KEY: 'resend-key',
  REMINDER_TO: 'a@x.com, b@x.com',
};
const request = (secret: string | null = 's3cret') => new Request('https://f/x', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} });
const NOW = new Date('2026-10-17T02:00:00Z'); // 7:30 am in India

function fakeFetch(rows: unknown[], emailOk = true) {
  const calls: Array<{ url: string; body?: string; headers?: Record<string, string> }> = [];
  const fn = async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    calls.push({ url, ...(init?.body ? { body: init.body } : {}), ...(init?.headers ? { headers: init.headers } : {}) });
    if (url.includes('resend')) return { ok: emailOk, status: emailOk ? 200 : 403, json: async () => ({}), text: async () => 'domain not verified' };
    return { ok: true, status: 200, json: async () => rows, text: async () => '' };
  };
  return { fn, calls };
}

describe('daily reminder job', () => {
  it('rejects a call without the shared secret and never reads data', async () => {
    const { fn, calls } = fakeFetch([]);
    expect((await handleReminderRequest(request(null), env, fn, NOW)).status).toBe(401);
    expect((await handleReminderRequest(request('wrong'), env, fn, NOW)).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('refuses to run when the secret is not configured at all', async () => {
    const { fn } = fakeFetch([]);
    expect((await handleReminderRequest(request(''), { ...env, CRON_SECRET: '' }, fn, NOW)).status).toBe(401);
  });

  it('emails everyone on the list when renewals need action', async () => {
    const { fn, calls } = fakeFetch([{ data: createSeedData('2026-10-17T00:00:00Z') }]);
    const response = await handleReminderRequest(request(), env, fn, NOW);
    expect(await response.json()).toEqual({ sent: true, items: 3, to: 2 });
    const mail = calls.find((c) => c.url.includes('resend'))!;
    const body = JSON.parse(mail.body!);
    expect(body.to).toEqual(['a@x.com', 'b@x.com']);
    expect(body.subject).toBe('Gold loan renewals: 3 due soon');
    expect(body.text).toContain('29 Oct 2026');
    expect(mail.headers!['Authorization']).toBe('Bearer resend-key');
  });

  it('sends nothing on a quiet day', async () => {
    const { fn, calls } = fakeFetch([{ data: createSeedData('2026-10-17T00:00:00Z') }]);
    const response = await handleReminderRequest(request(), env, fn, new Date('2026-01-05T02:00:00Z'));
    expect(await response.json()).toEqual({ sent: false, reason: 'Nothing needs action' });
    expect(calls.some((c) => c.url.includes('resend'))).toBe(false);
  });

  it('reports a refused email instead of pretending it was sent', async () => {
    const { fn } = fakeFetch([{ data: createSeedData('2026-10-17T00:00:00Z') }], false);
    const response = await handleReminderRequest(request(), env, fn, NOW);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain('refused');
  });

  it('names missing settings', async () => {
    const { fn } = fakeFetch([]);
    const response = await handleReminderRequest(request(), { ...env, RESEND_API_KEY: '' }, fn, NOW);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain('RESEND_API_KEY');
  });

  it('uses India\'s date even late in the UTC day', () => {
    expect(todayInIndia(new Date('2026-10-17T20:30:00Z'))).toBe('2026-10-18');
  });
});
