// ---------------------------------------------------------------------------
// HEARTBEAT JOB -- the trivial scheduled job that proves the runtime works.
// Writes one row to shadow_jobs. If rows appear every 15 minutes while AJ's
// laptop is closed, the whole Phase 2 premise is proven: Shadow runs without him.
// ---------------------------------------------------------------------------
import { getSupabase } from '../db.js';

export async function heartbeatJob() {
  const db = getSupabase();
  const row = {
    job_name: 'heartbeat',
    status: 'ok',
    ran_at: new Date().toISOString(),
    detail: 'scheduler alive'
  };
  const { error } = await db.from('shadow_jobs').insert(row);
  if (error) throw new Error(error.message);
  console.log('[heartbeat] ok ' + row.ran_at);
  return row;
}
