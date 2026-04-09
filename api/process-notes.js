// Vercel serverless — process raw meeting notes with Kimi (Max)
// POST /api/process-notes
// Body: { wm, project_name, gc, raw }
// Returns: { action_items, cor_triggers, schedule_updates }

const KIMI_BASE  = 'https://api.moonshot.ai/v1';
const KIMI_MODEL = 'kimi-k2.5';

const SYSTEM_PROMPT = `You are Max, the AI ops assistant for CTX Contractors.
Extract structured items from raw construction project meeting notes.
Return ONLY a JSON object with these three arrays (no other text):
{
  "action_items": [
    { "description": "...", "assigned_to": "Jaime", "due_date": "YYYY-MM-DD or empty" }
  ],
  "cor_triggers": [
    { "area": "...", "description": "...", "trigger_source": "GC verbal or email or RFI" }
  ],
  "schedule_updates": [
    { "area": "...", "note": "...", "flag": "behind|ahead|on_track" }
  ]
}
Rules:
- assigned_to is "Jaime" unless notes explicitly name someone else
- due_date in YYYY-MM-DD format; use empty string if not mentioned
- A COR trigger is any scope change, extra work request, or RFI from GC
- Only extract items actually mentioned in the notes`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.KIMI_API_KEY;
  if (!key) return res.status(500).json({ error: 'KIMI_API_KEY not configured' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const { wm, project_name, gc, raw } = body || {};
  if (!raw || !raw.trim()) {
    return res.status(200).json({ action_items: [], cor_triggers: [], schedule_updates: [] });
  }

  const userMsg = `Project: ${project_name || 'Unknown'} (WM#${wm || '?'})\nGC: ${gc || 'Unknown'}\n\nMeeting Notes:\n${raw}`;

  try {
    const r = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: `Kimi API error: ${r.status} — ${err}` });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '{}';

    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
