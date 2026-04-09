"""
migrate_projects.py
Loads all project JSONs from CTX_Dashboard/data/projects/ into Supabase.
Run once after creating the table.
"""
import json, os, sys
from pathlib import Path
import urllib.request, urllib.error

SUPABASE_URL = "https://xvcphvjycjtbgymugtct.supabase.co"
SERVICE_KEY  = "sb_secret_C6bWaApuyukeTjqOkdEpmA_19Bt_fjp"
PROJECTS_DIR = Path(__file__).parent.parent.parent / "CTX_Dashboard" / "data" / "projects"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

def upsert(record):
    url = f"{SUPABASE_URL}/rest/v1/dashboard_projects"
    data = json.dumps(record).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def main():
    files = sorted(PROJECTS_DIR.glob("*.json"))
    if not files:
        print(f"No JSON files found in {PROJECTS_DIR}")
        sys.exit(1)

    seen_ids = set()
    for f in files:
        try:
            with open(f, encoding="utf-8") as fh:
                proj = json.load(fh)
        except Exception as e:
            print(f"  SKIP {f.name}: {e}")
            continue

        wm_id = proj.get("wm_num") or f.stem.replace("WM", "").replace("-", "")
        if wm_id in seen_ids:
            print(f"  SKIP {f.name}: duplicate id {wm_id}")
            continue
        seen_ids.add(wm_id)

        record = {
            "id":         wm_id,
            "name":       proj.get("name", f.stem),
            "status":     proj.get("status", "active"),
            "gc":         proj.get("gc", ""),
            "start_date": proj.get("start_date") or None,
            "end_date":   proj.get("end_date") or None,
            "data":       proj,
            "inbox_data": {},
            "updated_by": "migration_script",
        }

        status, body = upsert(record)
        if status in (200, 201):
            print(f"  OK  WM-{wm_id}  {record['name']}")
        else:
            print(f"  ERR WM-{wm_id}  {status}  {body[:200]}")

    print(f"\nDone. {len(seen_ids)} projects processed.")

if __name__ == "__main__":
    main()
