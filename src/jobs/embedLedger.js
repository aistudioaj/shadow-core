// ---------------------------------------------------------------------------
// EMBED LEDGER JOB -- fills embeddings for shadow_ledger rows that lack one.
// Handles BOTH backfill (existing rows) and new rows (written by the client
// Council in index.html). Fully decoupled: the app writes verdicts, Shadow Core
// embeds them on a schedule. No client change needed for the ingestion side.
//
// Batched (limit 20/run) so a burst of new verdicts is caught over a few runs
// rather than one heavy invocation.
// ---------------------------------------------------------------------------
import { getSupabase } from '../db.js';
import { embedText, toPgVector } from '../embed.js';

export async function embedLedgerJob() {
  const db = getSupabase();

  // Service key bypasses RLS -- we intentionally process all owners' un-embedded rows.
  const { data, error } = await db
    .from('shadow_ledger')
    .select('id, question, verdict, full_position')
    .is('embedding', null)
    .limit(20);

  if (error) throw new Error('select: ' + error.message);
  if (!data || data.length === 0) return { embedded: 0 };

  let done = 0;
  for (const row of data) {
    try {
      const text = [row.question, row.verdict, row.full_position]
        .filter(Boolean)
        .join('\n\n');
      const vec = await embedText(text);
      const { error: upErr } = await db
        .from('shadow_ledger')
        .update({ embedding: toPgVector(vec) })
        .eq('id', row.id);
      if (upErr) {
        console.error('[embed] update failed ' + row.id + ': ' + upErr.message);
        continue;
      }
      done++;
    } catch (e) {
      console.error('[embed] row ' + row.id + ' failed: ' + (e.message || e));
    }
  }

  if (done > 0) console.log('[embed] embedded ' + done + ' ledger row(s)');
  return { embedded: done };
}
