-- CTX Dashboard Projects Table
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS dashboard_projects (
  id           TEXT PRIMARY KEY,         -- "1666", "7281", etc.
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  gc           TEXT,
  start_date   DATE,
  end_date     DATE,
  data         JSONB NOT NULL DEFAULT '{}',   -- full project JSON
  inbox_data   JSONB DEFAULT '{}',            -- email-extracted contacts + dates
  updated_at   TIMESTAMPTZ DEFAULT now(),
  updated_by   TEXT
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dashboard_projects_updated ON dashboard_projects;
CREATE TRIGGER trg_dashboard_projects_updated
  BEFORE UPDATE ON dashboard_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE dashboard_projects ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all projects
CREATE POLICY "auth_read" ON dashboard_projects
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can update projects
CREATE POLICY "auth_update" ON dashboard_projects
  FOR UPDATE TO authenticated USING (true);

-- Service role can do anything (for inbox sync script)
CREATE POLICY "service_all" ON dashboard_projects
  FOR ALL TO service_role USING (true);
