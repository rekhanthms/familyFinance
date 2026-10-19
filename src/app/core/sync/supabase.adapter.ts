import type { SupabaseClient } from '@supabase/supabase-js';
import type { FamilyFinanceData } from '../../domain';
import type { AuthPort, PushResult, RemoteSnapshot, RemoteStore } from './sync.ports';

const TABLE = 'family_snapshot';
const ROW_ID = 'main';

/** Loaded on demand, so people who never turn sync on never download the Supabase code. */
export async function createSupabaseClient(url: string, anonKey: string): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

export class SupabaseRemoteStore implements RemoteStore {
  constructor(private readonly client: SupabaseClient) {}

  async pull(): Promise<RemoteSnapshot | null> {
    const { data, error } = await this.client.from(TABLE).select('data, version').eq('id', ROW_ID).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { data: data.data as FamilyFinanceData, version: Number(data.version) } : null;
  }

  async push(data: FamilyFinanceData, expectedVersion: number): Promise<PushResult> {
    // The database function does the compare-and-set in one statement; see supabase/schema.sql.
    const { data: result, error } = await this.client.rpc('push_snapshot', { new_data: data, expected_version: expectedVersion });
    if (error) return { ok: false, reason: 'error', message: error.message };
    const version = Number(result);
    return version < 0 ? { ok: false, reason: 'conflict' } : { ok: true, version };
  }
}

export class SupabaseAuth implements AuthPort {
  constructor(private readonly client: SupabaseClient) {}

  async currentEmail(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.user.email ?? null;
  }

  async sendCode(email: string): Promise<void> {
    // Anyone can ask for a code, but the database rules show data only to the emails listed in supabase/schema.sql.
    const { error } = await this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw new Error(error.message);
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) throw new Error(error.message);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}
