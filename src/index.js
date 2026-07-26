import express from 'express';
import cron from 'node-cron';
import { heartbeatJob } from './jobs/heartbeat.js';
import { embedLedgerJob } from './jobs/embedLedger.js';
import { getSupabase, getUserScopedSupabase } from './db.js';
import { embedText, toPgVector } from './embed.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STARTED_AT = new Date().toISOString();

const ALLOWED_ORIGIN = 'https://aistudioaj.github.io';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', async (req, res) => {
  const health = {
    status: 'ok', service: 'shadow-core',
    started_at: STARTED_AT, uptime_seconds: Math.floor(process.uptime()),
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
    supabase_anon_key: !!process.env.SUPABASE_ANON_KEY,
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

app.post('/retrieve', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing bearer token' });

    const query = (req.body && req.body.query) || '';
    const matchCount = (req.body && req.body.match_count) || 5;
    if (!query) return res.status(400).json({ error: 'missing query' });

    const vec = await embedText(query);
    const vecStr = toPgVector(vec);

    const userDb = getUserScopedSupabase(token);
    const { data, error } = await userDb.rpc('match_ledger', {
      query_embedding: vecStr,
      match_count: matchCount
    });
    if (error) return res.status(500).json({ error: 'search: ' + error.message });

    return res.json({ matches: data || [] });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

function startScheduler() {
  cron.schedule('*/15 * * * *', async () => {
    try { await heartbeatJob(); }
    catch (e) { console.error('[cron] heartbeat failed:', e.message || e); }
  });
  console.log('[scheduler] registered: heartbeat (*/15 * * * *)');

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
