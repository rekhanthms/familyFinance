# Turning on sync (free, about 10 minutes)

The app works fully without this. Sync only lets your phone and PC share the same records.

## 1. Create the free project
1. Go to supabase.com and sign up (free plan, no card).
2. New project: pick any name, a strong database password (save it), and the region nearest you (Mumbai if offered).
3. Wait until the project finishes setting up.

## 2. Create the tables and the allowed list
1. Left menu: SQL Editor, New query.
2. Open `supabase/schema.sql` from this project, edit the email list at the bottom to the addresses that should sync, paste everything, press Run.
3. It should say "Success".

## 3. Make the sign-in email show a code
1. Authentication, Emails (or Email Templates), the "Magic Link" template.
2. Replace the body with a line like: `Your Family Finance code is: {{ .Token }}`
3. Save.

## 4. Copy two values into the app
1. Project Settings, API (or Data API / API Keys).
2. Copy the **Project URL** and the **anon / public key** (never the service_role key).
3. Paste them into `src/app/core/sync/sync-config.ts`, rebuild and redeploy.

## 5. Sign in
Settings, Sync: enter your email, then the 6-digit code from the email. On a new device the app asks whether to use the shared copy or combine; for a new phone choose "Use the shared copy".

## Good to know
- Free Supabase projects pause after a period of no use (about a week at the time of writing). Opening the app and syncing resets that. Unpausing is one click in the dashboard, and nothing is lost.
- The shared copy holds names, amounts, dates and the last 4 digits of loan references, nothing else. Access is limited to the emails in `allowed_emails`.
- Keep making backups. Sync is not a backup: a mistaken delete syncs too.
- Free-tier limits and menu names change; check Supabase's current docs if a step looks different.
