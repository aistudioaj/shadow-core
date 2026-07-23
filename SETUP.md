# SHADOW CORE — RAILWAY SETUP

**What this is:** the Phase 2 orchestration runtime, step 1. A small always-on Node service with a health endpoint and a working scheduler. No agents yet — this proves the foundation before we build on it.

**Time needed:** ~20-30 minutes at the laptop. **Cost:** roughly $5/month at this size (verify current Railway pricing).

**The proof this must pass:** heartbeat rows keep appearing in Supabase *while your laptop is closed*. That single fact demonstrates the entire Phase 2 premise — Shadow runs without you.

---

## SECURITY RULE (read first)

**Never paste API keys, service keys, or tokens into the chat with Claude.** All secrets go directly into Railway's Variables dashboard or your local `.env` (which is gitignored). Claude never needs to see their values — only whether they're set. This is not a formality: the Supabase service key bypasses RLS and can read every row in your database.

---

## STEP 1 — Create the Supabase table

In the Supabase dashboard (project `xqdnohqbimfrtalvdmyp`) go to **SQL Editor** and run:

```sql
create table if not exists shadow_jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  ran_at timestamptz not null default now(),
  detail text,
  owner uuid default auth.uid()
);

alter table shadow_jobs enable row level security;

-- users can read their own job rows; the service key bypasses RLS for writes
create policy "own rows" on shadow_jobs
  for select using (auth.uid() = owner);
```

Note the `owner` column — per the standing principle, every new table is multi-tenant from day one. No more hardcoded-user shortcuts.

---

## STEP 2 — Get the repo onto GitHub

Create a **new, private** repo (suggested name `shadow-core`) — separate from `project-shadow`, which stays the PWA.

```bash
cd ~/Downloads/shadow-core       # wherever you unpacked it
git init
git add .
git commit -m "Shadow Core: orchestration runtime skeleton"
git branch -M main
git remote add origin https://github.com/aistudioaj/shadow-core.git
git push -u origin main
```

Confirm `.env` is NOT in the repo (`.gitignore` covers it, but check).

---

## STEP 3 — Deploy on Railway

1. Sign up at railway.com with your GitHub account.
2. **New Project** → **Deploy from GitHub repo** → pick `shadow-core`.
3. Railway auto-detects Node and runs `npm start`. Let the first deploy run — it will fail health checks until step 4. That's expected.

---

## STEP 4 — Set the variables

In the service → **Variables** tab, add:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → **service_role** key (secret) |
| `SHADOW_PROXY_URL` | `https://shadow-proxy.aistudio-aj.workers.dev/` |
| `TZ` | `Asia/Dubai` |

Do not set `PORT` — Railway injects it.

Deploy the staged changes.

---

## STEP 5 — Generate a domain and verify

Service → **Settings** → **Networking** → **Generate Domain**.

Then open `https://<your-domain>/health`. You want:

```json
{
  "status": "ok",
  "service": "shadow-core",
  "checks": { "supabase": "ok", "config": { ... } }
}
```

If `supabase` shows an error, the URL or service key is wrong. If `status` is `degraded`, the endpoint is honestly telling you something is down — which is the point of it.

---

## STEP 6 — THE REAL TEST (do this one properly)

1. Note the time.
2. **Close your laptop. Walk away for an hour.**
3. Come back and check the `shadow_jobs` table in Supabase.

You should see heartbeat rows every 15 minutes, including while the laptop was shut. That is Phase 2 proven: Shadow now runs when you don't.

---

## WHAT COMES NEXT (not in this step)

Once the runtime is proven, the build sequence from the architecture doc continues:
- ledger + memory schema (pgvector)
- migrate the Council through the orchestrator as the one-agent proof
- retrieval + outcome-scoring job
- the first real proactive scan (portfolio drift)

Nothing else gets built until the heartbeat test passes. Foundation first.

---

## TROUBLESHOOTING

- **Build fails:** check the deploy logs in Railway; usually a Node version issue (needs >= 20).
- **Health endpoint 503:** read the `checks` object — it names the failing dependency.
- **No heartbeat rows:** check Railway logs for `[scheduler] registered`. If missing, the service crashed on boot. If present but no rows, it's the Supabase write — check the service key and that `shadow_jobs` exists.
- **Cron timing looks off:** confirm `TZ=Asia/Dubai` is set.
