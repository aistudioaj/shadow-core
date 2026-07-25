// ---------------------------------------------------------------------------
// SHADOW CORE -- embeddings
// Called server-side from Railway (US egress), so there is NO UAE geo-block here:
// direct to api.openai.com is fine. This is the geo-block-free property of moving
// model calls server-side.
//
// Model: text-embedding-3-small (1536 dims) -- verified current default July 2026,
// and it MATCHES shadow_ledger.embedding vector(1536). If we ever switch to
// text-embedding-3-large (3072), the ledger column dimension must change AND every
// row must be re-embedded (embeddings from different models are not comparable).
//
// KEY: reuses OPENAI_KEY (AJ already has this key sitting unused in the Worker).
// ---------------------------------------------------------------------------

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIM = 1536;

export async function embedText(text) {
  const key = process.env.OPENAI_KEY;
  if (!key) throw new Error('OPENAI_KEY not set');
  const clean = (text || '').slice(0, 8000); // stay well under token limits
  if (!clean) throw new Error('embedText: empty input');

  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: clean })
  });

  const raw = await r.text();
  if (!r.ok) throw new Error('embeddings ' + r.status + ': ' + raw.slice(0, 300));

  let json;
  try { json = JSON.parse(raw); } catch (e) { throw new Error('embeddings: non-JSON response'); }

  const vec = json && json.data && json.data[0] && json.data[0].embedding;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIM) {
    throw new Error('embeddings: unexpected vector shape (len ' + (vec ? vec.length : 'none') + ')');
  }
  return vec;
}

// pgvector accepts a string literal '[v1,v2,...]' reliably across supabase-js versions.
// (Passing a bare JS array is version-dependent; the string form is the safe choice.)
export function toPgVector(arr) {
  return '[' + arr.join(',') + ']';
}
