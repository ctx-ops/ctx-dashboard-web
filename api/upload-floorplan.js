// Vercel serverless function — proxies floor plan PDF uploads to Supabase Storage
// Uses SUPABASE_SERVICE_KEY env var (set in Vercel dashboard) to bypass RLS

export const config = { api: { bodyParser: false } };

const SB_URL  = 'https://xvcphvjycjtbgymugtct.supabase.co';
const SVC_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const wm = req.query.wm;
  if (!wm) return res.status(400).json({ error: 'Missing wm param' });
  if (!SVC_KEY) return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_KEY' });

  // Read raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const storageUrl = `${SB_URL}/storage/v1/object/floor-plans/${wm}/A1.pdf`;
  const r = await fetch(storageUrl, {
    method: 'POST',
    headers: {
      'apikey': SVC_KEY,
      'Authorization': `Bearer ${SVC_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body,
  });

  if (!r.ok) {
    const text = await r.text();
    return res.status(r.status).json({ error: text });
  }

  return res.status(200).json({ ok: true, bytes: body.length });
}
