// ---------------------------------------------------------------------------
// SHADOW CORE -- Supabase client
// Uses the SERVICE ROLE key: runs server-side on behalf of scheduled jobs.
// NEVER ship this key to the client. Service key bypasses RLS, so every query
// here MUST scope by owner explicitly.
//
// WHY THE 'ws' IMPORT: supabase-js initializes a realtime (WebSocket) client
// even when unused. On Node < 22 there is no native WebSocket, so it errors at
// startup. Shadow Core does plain reads/writes only -- supplying 'ws' makes it
// run on ANY Node version.
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
