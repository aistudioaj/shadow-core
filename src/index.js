// ============================================================================
// SHADOW CORE -- orchestration service entry point
// Phase 2 runtime. Health endpoint + scheduler.
// ============================================================================

import express from 'express';
import cron from 'node-cron';
import { heartbeatJob } from './jobs/heartbeat.js';
import { embedLedgerJob } from './jobs/embedLedger.js';
import { getSupabase } from './db.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STARTED_AT = new Date().toISOString();

// ---------------------------------------------------------------------------
// HEALTH ENDPOINT -- "provably stable". Reads a real dependency, not a fake 200.
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'shadow-core',
    started_at: STARTED_AT,
    uptime_seconds: Math.floor(process.uptime()),
    checks: {}
  };

  try {
    const db = getSupabase();
    const { error } = await db.from('shadow_jobs').select('id').limit(1);
    health.checks.supabase = error ? ('error: ' + error.message) : 'ok';
  } catch (e) {
    health.checks.supabase = 'error: ' + String(e.message || e);
  }

  health.checks.config = {
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
    openai_key: !!process.env.OPENAI_KEY,
    proxy_url: !!process.env.SHADOW_PROXY_URL
  };

  const degraded = health.checks.supabase !== 'ok';
  health.status = degraded ? 'degraded' : 'ok';
  res.status(degraded ? 503 : 200).json(health);
});

app.get('/', (req, res) => {
  res.json({ service: 'shadow-core', status: 'running', see: '/health' });
});

// ---------------------------------------------------------------------------
// SCHEDULER
// ---------------------------------------------------------------------------
function startScheduler() {
  cron.schedule('*/15 * * * *', async () => {
    try { await heartbeatJob(); }
    catch (e) { console.error('[cron] heartbeat failed:', e.message || e); }
  });
  console.log('[scheduler] registered: heartbeat (*/15 * * * *)');

  // embed any un-embedded ledger rows (backfill + ongoing)
  cron.schedule('*/2 * * * *', async () => {
    try { await embedLedgerJob(); }
    catch (e) { console.error('[cron] embedLedger failed:', e.message || e); }
  });
  console.log('[scheduler] registered: embedLedger (*/2 * * * *)');
}

app.listen(PORT, () => {
  console.log('[shadow-core] listening on ' + PORT);
  startScheduler();
});
