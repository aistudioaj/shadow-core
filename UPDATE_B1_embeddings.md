# SHADOW CORE UPDATE -- B-1: ledger embeddings

**What this adds:** a scheduled job that reads any `shadow_ledger` row without an
embedding, generates one (OpenAI, called server-side from Railway -- no geo-block),
and stores it. Runs every 2 minutes. Handles your existing rows and every future
Council verdict automatically. This is the ingestion half of semantic retrieval;
the reading half (B-2/B-3) comes next.

**No app change. No database change.** Pure Shadow Core.

---

## FILES

- NEW: `src/embed.js`
- NEW: `src/jobs/embedLedger.js`
- CHANGED: `src/index.js` (registers the new job; adds openai_key to /health config)
- CHANGED: `.env.example` (adds OPENAI_KEY)

Easiest: unzip the updated `shadow-core` and push the whole thing, OR add/replace
just these four files in your local repo.

---

## STEPS

**1. Add the OpenAI key to Railway** (one-time)
Railway -> shadow-core -> Variables -> add:

| Name | Value |
|---|---|
| `OPENAI_KEY` | your OpenAI API key -- the SAME one already sitting in the Worker as OPENAI_KEY |

You already have this key; it's currently unused in the Worker since OpenAI routes
through OpenRouter now. Reuse that value. **Do not paste it into chat -- Railway only.**

**2. Push the code**
```bash
cd ~/Downloads/shadow-core        # or wherever your repo is
git add .
git commit -m "B-1: ledger embedding job"
git push
```
Railway auto-deploys on push.

**3. Verify the deploy**
Open `https://<your-domain>/health`. In `checks.config` you should now see
`"openai_key": true`. If it's `false`, the key didn't save in step 1.

**4. Watch it work** (the real test)
- Give it 2-4 minutes after deploy.
- In Supabase -> Table Editor -> `shadow_ledger`, look at the `embedding` column
  for your existing verdict row(s). It should change from null to a long vector.
- OR watch Railway logs for `[embed] embedded N ledger row(s)`.

If embeddings appear, B-1 is done and every verdict from now on gets embedded
automatically.

---

## IF SOMETHING FAILS

Read Railway logs -- the job names the exact problem:
- `OPENAI_KEY not set` -> step 1 didn't take.
- `embeddings 401` -> the OpenAI key is wrong/expired.
- `embeddings 429` -> rate/quota; it'll retry next run.
- `update failed ... invalid input syntax for type vector` -> the one thing I could
  NOT test in-sandbox: the pgvector write format. Tell me and I'll adjust `toPgVector`.
  Nothing else breaks; the ledger keeps working, rows just stay un-embedded until fixed.

The job is safe to fail -- it only reads and updates its own rows, retries every run,
and never touches the app or the Council.
