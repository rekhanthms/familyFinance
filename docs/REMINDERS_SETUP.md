# Reminders

Two ways, both free. Neither sends anything you did not set up.

## A. WhatsApp, one tap (works now, nothing to set up)
- **Renewals** screen, "Share what needs action on WhatsApp": one message listing every renewal that needs action.
- **Each loan** has "Share on WhatsApp" with that loan's details.
- Save a member's WhatsApp number (Family screen, with country code) and their loans open straight into a chat with them. Without a number, WhatsApp asks which chat.
- You tap Send yourself. The app never says a message was sent.

Fully automatic WhatsApp needs a WhatsApp Business account and Meta's approval of message templates, which costs money per message. It is a later option, not part of the free setup.

## B. Daily email at 7:00 am India time (needs sync set up first, see SYNC_SETUP.md)
The email lists every renewal that needs action, including ones you dismissed in the app, and is skipped on days when nothing needs action.

1. **Email sender (free).** Sign up at resend.com, create an API key. On the free plan without your own domain, Resend only delivers to the email you signed up with, which is fine for one person. To mail several people you need to verify a domain.
2. **Create the function.** Supabase dashboard, Edge Functions, New function, name it exactly `daily-reminders`, paste the whole of `supabase/functions/daily-reminders/index.ts`, and deploy it with JWT verification **off** (the function checks its own secret).
3. **Set its secrets** (Edge Functions, Secrets). Supabase fills in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` itself.
   - `CRON_SECRET`: any long random text you invent
   - `RESEND_API_KEY`: from step 1
   - `REMINDER_TO`: the address(es), comma separated
   - `APP_URL`: optional, where your app is hosted
   - `REMINDER_FROM`: optional, leave out to use Resend's test sender
4. **Schedule it.** SQL Editor, run this once with your own project address and the same secret as above (01:30 UTC is 7:00 am in India):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-reminders',
  '30 1 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

5. **Try it now.** Dashboard, Edge Functions, `daily-reminders`, Test, with header `x-cron-secret`. The answer says `sent: true`, or why nothing was sent ("Nothing needs action").

## Good to know
- The email reads the synced copy. If a device has not synced, the email can be a day behind.
- The service-role key and cron secret live only inside Supabase. Never put them in the app.
- If the email provider refuses a message, the job answers with an error instead of claiming success; check Edge Functions, Logs.
- After changing the renewal rules in the app code, run `npm run build:function` and paste the new file, so the email and the app agree.
- Menu names and free-plan limits change; check the Supabase and Resend docs if a step looks different.
