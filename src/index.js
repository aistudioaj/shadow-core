// ============================================================================
// SHADOW CORE -- orchestration service entry point
// Phase 2, step 1: prove the runtime (server + scheduler + Supabase write).
// Deliberately minimal. Agents come later; this is the foundation they run on.
// ============================================================================

import express from 'express';
import cron from 'node-cron';
import { heartbeatJob } from './jobs/heartbeat.js';
import { getSupabase } from './db.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STARTED_AT = new Date().toISOString();

// ---------------------------------------------------------------------------
// HEALTH ENDPOINT
// This is also Phase 0's "provably stable" requirement: AJ's stated top pain is
// not knowing whether Shadow is up. This endpoint is the ground truth, and the
// admin dashboard will read it later.
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'shadow-core',
    started_at: STARTED_AT,
    uptime_seconds: Math.floor(process.uptime()),
    checks: {}
  };

  // Supabase reachability -- a real dependency check, not a fake 200.
  try {
    const db = getSupabase();
    const { error } = await db.from('shadow_jobs').select('id').limit(1);
    health.checks.supabase = error ? ('error: ' + error.message) : 'ok';
  } catch (e) {
    health.checks.supabase = 'error: ' + String(e.message || e);
  }

  // Config presence (never expose values, only whether they are set).
  health.checks.config = {
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
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
// Proves cron works on the host. Real scans (portfolio drift, Suhail world-scan,
// outcome-scoring) get registered here as they are built.
// TZ is set via the TZ env var (set to Asia/Dubai on Railway).
// ---------------------------------------------------------------------------
function startScheduler() {
  // every 15 minutes -- writes a row proving the scheduler is alive
  cron.schedule('*/15 * * * *', async () => {
    try {
      await heartbeatJob();
    } catch (e) {
      console.error('[cron] heartbeat failed:', e.message || e);
    }
  });
  console.log('[scheduler] registered: heartbeat (*/15 * * * *)');
}

app.listen(PORT, () => {
  console.log('[shadow-core] listening on ' + PORT);
  startScheduler();
});
