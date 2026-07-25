// ---------------------------------------------------------------------------
// SHADOW CORE -- Supabase client
// Uses the SERVICE ROLE key: this runs server-side and must act on behalf of
// scheduled jobs (no user session). NEVER ship this key to the client.
// Multi-tenancy note: because the service key bypasses RLS, every query written
// here MUST scope by owner explicitly. See PHASE2 architecture section 8.
//
// WHY THE 'ws' IMPORT:
// supabase-js initializes a realtime (WebSocket) client even when unused. On
// Node < 22 there is no native WebSocket, so it errors at startup. Shadow Core
// does plain reads/writes only -- no realtime -- but we must still satisfy the
// library. Supplying 'ws' makes the service run on ANY Node version, so we never
// depend on what the build system picks. See LESSONS: fix the class of failure,
// not the instance.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });
  return _client;
}
