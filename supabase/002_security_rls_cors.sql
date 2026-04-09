-- ── CTX Dashboard — Security: RLS + CORS ─────────────────────────────────
-- Run this once in Supabase SQL Editor
-- Project: xvcphvjycjtbgymugtct

-- ── 1. Enable RLS on dashboard_projects ─────────────────────────────────────
ALTER TABLE dashboard_projects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all projects
CREATE POLICY "authenticated can read projects"
ON dashboard_projects FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update projects
CREATE POLICY "authenticated can update projects"
ON dashboard_projects FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert projects
CREATE POLICY "authenticated can insert projects"
ON dashboard_projects FOR INSERT
TO authenticated
WITH CHECK (true);

-- ── 2. Storage: floor-plans bucket policies ──────────────────────────────────
-- Drop any failed previous attempts
DROP POLICY IF EXISTS "auth users can upload floor plans" ON storage.objects;
DROP POLICY IF EXISTS "auth users can update floor plans" ON storage.objects;
DROP POLICY IF EXISTS "allow floor-plans insert" ON storage.objects;
DROP POLICY IF EXISTS "allow floor-plans update" ON storage.objects;
DROP POLICY IF EXISTS "allow floor-plans delete" ON storage.objects;

-- (Floor plan uploads now go to Azure Blob Storage — no Storage policies needed)
-- These are kept here for reference if you switch back to Supabase Storage.

-- ── 3. CORS — set allowed origins via Supabase Dashboard ────────────────────
-- Go to: Project Settings → API → CORS (Allowed origins)
-- Add these origins (one per line):
--   https://ctx-ops.vercel.app
--   http://localhost:8765
--   http://localhost:8080
--
-- You cannot set CORS via SQL — must be done in the dashboard UI.

-- ── 4. Restrict anon key — prevent unauthenticated reads ────────────────────
-- The dashboard already checks for a valid session before loading.
-- This policy ensures the DB also blocks unauthenticated requests:
REVOKE SELECT ON dashboard_projects FROM anon;
REVOKE INSERT ON dashboard_projects FROM anon;
REVOKE UPDATE ON dashboard_projects FROM anon;
REVOKE DELETE ON dashboard_projects FROM anon;
