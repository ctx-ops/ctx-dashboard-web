// Vercel serverless — compose + send meeting summary email
// POST /api/send-summary
// Body: { wm }
// Returns: { sent: true, action_items, cors } or { sent: false, subject, body } on auth failure

const SB_URL     = 'https://xvcphvjycjtbgymugtct.supabase.co';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getGraphToken() {
  const tenantId  = process.env.GRAPH_TENANT_ID;
  const clientId  = process.env.GRAPH_CLIENT_ID;
  const clientSec = process.env.GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSec) throw new Error('Graph env vars not configured');

  const r = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSec,
      scope:         'https://graph.microsoft.com/.default',
    }),
  });
  if (!r.ok) throw new Error(`Token fetch failed: ${r.status} — ${await r.text()}`);
  const d = await r.json();
  if (!d.access_token) throw new Error(d.error_description || 'No access_token in response');
  return d.access_token;
}

async function getProject(wm) {
  const svcKey = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${SB_URL}/rest/v1/dashboard_projects?id=eq.${wm}&select=data&limit=1`, {
    headers: {
      'apikey': svcKey,
      'Authorization': `Bearer ${svcKey}`,
    },
  });
  if (!r.ok) throw new Error(`Supabase fetch failed: ${r.status}`);
  const rows = await r.json();
  return (rows[0] && rows[0].data) ? rows[0].data : null;
}

function composeSummary(proj, wm) {
  const today = new Date().toISOString().slice(0,10);
  const openItems = (proj.action_items||[]).filter(a => a.status !== 'done' && a.status !== 'closed');
  const openCors  = (proj.cors||[]).filter(c => ['drafting','sent','gc_approval'].includes(c.status));

  const subject = `Meeting Summary — ${proj.name || 'WM'+wm} — ${today}`;
  let body = `Meeting Summary: ${proj.name || 'WM'+wm}\nDate: ${today}\nGC: ${proj.gc || '—'}\n\n`;

  if (openItems.length) {
    body += `ACTION ITEMS (${openItems.length} open)\n`;
    openItems.forEach(a => {
      body += `  • ${a.description} — Owner: ${a.assigned_to || 'Jaime'} — Due: ${a.due_date || 'TBD'}\n`;
    });
    body += '\n';
  }
  if (openCors.length) {
    body += `OPEN CORS (${openCors.length})\n`;
    openCors.forEach(c => {
      body += `  • ${c.id || 'COR'} [${(c.status||'').toUpperCase()}]: ${c.description} — Area: ${c.area || '—'}\n`;
    });
    body += '\n';
  }
  body += `—\nMax (CTX Operations AI)\n`;

  return { subject, body, openItems: openItems.length, openCors: openCors.length };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const wm = (body?.wm || '').replace(/^WM-?/i, '');
  if (!wm) return res.status(400).json({ error: 'Missing wm' });

  const proj = await getProject(wm).catch(e => null);
  if (!proj) return res.status(404).json({ error: `Project WM${wm} not found` });

  const { subject, body: emailBody, openItems, openCors } = composeSummary(proj, wm);
  const sender = process.env.SENDER_MAILBOX || 'ctx_ops@ctxcontractors.com';

  // Try sending via Graph API
  try {
    const token = await getGraphToken();
    const r = await fetch(`${GRAPH_BASE}/users/${sender}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: emailBody },
          toRecipients: [{ emailAddress: { address: 'jaime@ctxcontractors.com' } }],
        },
        saveToSentItems: true,
      }),
    });

    if (r.ok || r.status === 202) {
      return res.status(200).json({ sent: true, action_items: openItems, cors: openCors });
    }

    // Graph returned an error — fall through to compose-only response
    const errText = await r.text();
    console.error('Graph sendMail failed:', r.status, errText);

  } catch(e) {
    console.error('Graph token/send error:', e.message);
  }

  // Fallback: return composed email so dashboard can display it
  return res.status(200).json({
    sent: false,
    subject,
    body: emailBody,
    action_items: openItems,
    cors: openCors,
    note: 'Email could not be sent automatically — copy the text below to send manually.',
  });
}
