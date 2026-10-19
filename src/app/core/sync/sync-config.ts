/**
 * Fill these two values after creating your free Supabase project (see docs/SYNC_SETUP.md).
 * Both are PUBLIC by design: the anon key only works through the row-level-security rules in
 * supabase/schema.sql, which allow just the email addresses you list. Never put the service_role key here.
 */
export const SYNC_CONFIG: { url: string; anonKey: string } = {
  url: '',
  anonKey: '',
};

export const isSyncConfigured = (config = SYNC_CONFIG): boolean => config.url.startsWith('https://') && config.anonKey.length > 20;
