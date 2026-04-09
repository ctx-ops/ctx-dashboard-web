// data.js — Supabase data layer for CTX Dashboard
const SB_URL = 'https://xvcphvjycjtbgymugtct.supabase.co';
const SB_KEY = 'sb_publishable_pV1wYW361UNhzmPz-3ltzg_hOhfIv7g';

function getSession() {
  try { return JSON.parse(localStorage.getItem('ctx_session')); } catch(e) { return null; }
}

function authHeaders() {
  const s = getSession();
  return {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${s ? s.access_token : SB_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sbGet(path) {
  const r = await fetch(SB_URL + path, { headers: authHeaders() });
  if (r.status === 401) { localStorage.removeItem('ctx_session'); window.location.href = 'index.html'; }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function sbPatch(path, body) {
  const r = await fetch(SB_URL + path, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.ok;
}

// ── Public API ─────────────────────────────────────────────────────────────

window.DB = {

  async fetchAll() {
    return sbGet('/rest/v1/dashboard_projects?select=*&order=status.asc,start_date.asc');
  },

  async fetchOne(id) {
    const rows = await sbGet(`/rest/v1/dashboard_projects?id=eq.${id}&select=*&limit=1`);
    return rows[0] || null;
  },

  async saveField(id, field, value, userEmail) {
    // field is a dot-path into the data JSONB, e.g. "gc_pm.email"
    // For top-level fields we patch the data column directly
    const row = await this.fetchOne(id);
    if (!row) throw new Error('Project not found');
    const data = { ...row.data };
    setDeep(data, field, value);
    return sbPatch(`/rest/v1/dashboard_projects?id=eq.${id}`, {
      data,
      updated_by: userEmail || 'dashboard',
    });
  },

  async saveData(id, data, userEmail) {
    return sbPatch(`/rest/v1/dashboard_projects?id=eq.${id}`, {
      data,
      updated_by: userEmail || 'dashboard',
      status: data.status,
    });
  },

  async updateCOR(projectId, corId, updates, userEmail) {
    const row = await this.fetchOne(projectId);
    if (!row) throw new Error('Project not found');
    const data = { ...row.data };
    const cors = data.cors || [];
    const idx = cors.findIndex(c => c.id === corId);
    if (idx === -1) throw new Error('COR not found');
    cors[idx] = { ...cors[idx], ...updates };
    data.cors = cors;
    return sbPatch(`/rest/v1/dashboard_projects?id=eq.${projectId}`, { data, updated_by: userEmail });
  },

  async closeActionItem(projectId, aiId, userEmail) {
    const row = await this.fetchOne(projectId);
    if (!row) throw new Error('Project not found');
    const data = { ...row.data };
    const items = data.action_items || [];
    const idx = items.findIndex(a => a.id === aiId);
    if (idx === -1) throw new Error('Action item not found');
    items[idx].status = 'closed';
    items[idx].closed_at = new Date().toISOString();
    data.action_items = items;
    return sbPatch(`/rest/v1/dashboard_projects?id=eq.${projectId}`, { data, updated_by: userEmail });
  },

  async addMeetingNote(projectId, noteText, userEmail) {
    const row = await this.fetchOne(projectId);
    if (!row) throw new Error('Project not found');
    const data = { ...row.data };
    data.meeting_notes = data.meeting_notes || [];
    data.meeting_notes.push({
      date: new Date().toISOString().split('T')[0],
      raw: noteText,
      processed: false,
      processed_at: null,
    });
    return sbPatch(`/rest/v1/dashboard_projects?id=eq.${projectId}`, { data, updated_by: userEmail });
  },
};

function setDeep(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}
