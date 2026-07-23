// ---------------------------------------------------------------------------
// SHADOW CORE -- Supabase client
// Uses the SERVICE ROLE key: this runs server-side and must act on behalf of
// scheduled jobs (no user session). NEVER ship this key to the client.
// Multi-tenancy note: because the service key bypasses RLS, every query written
// here MUST scope by owner explicitly. See PHASE2 architecture section 8.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}
