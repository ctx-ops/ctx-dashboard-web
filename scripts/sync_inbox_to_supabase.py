"""
sync_inbox_to_supabase.py
Reads inbox-extracted project contacts and syncs them to the
dashboard_projects.inbox_data column in Supabase.

Run: python sync_inbox_to_supabase.py
Schedule: add to your nightly pipeline (Tue/Fri) or run on demand.
"""
import json, sys, os
from pathlib import Path
import urllib.request, urllib.error

SUPABASE_URL = "https://xvcphvjycjtbgymugtct.supabase.co"
SERVICE_KEY  = "sb_secret_C6bWaApuyukeTjqOkdEpmA_19Bt_fjp"

# Paths to existing inbox data outputs
INBOX_CACHE_PATHS = [
    Path("C:/Users/Max_CTX/Box/CTX_Field_App/inbox_contacts_cache.json"),
    Path("C:/Users/Max_CTX/Box/CTX_Dashboard/data/inbox_contacts.json"),
]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def patch_project(wm_id, inbox_data):
    url = f"{SUPABASE_URL}/rest/v1/dashboard_projects?id=eq.{wm_id}"
    body = json.dumps({"inbox_data": inbox_data, "updated_by": "inbox_sync"}).encode()
    req = urllib.request.Request(url, data=body, headers={**HEADERS, "X-HTTP-Method-Override": "PATCH"}, method="PATCH")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code

def load_inbox_cache():
    for path in INBOX_CACHE_PATHS:
        if path.exists():
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                print(f"Loaded inbox cache from {path}")
                return data
            except Exception as e:
                print(f"Could not read {path}: {e}")
    return None

def main():
    inbox = load_inbox_cache()
    if not inbox:
        print("No inbox cache found. Run read_ctx_inbox.py first.")
        sys.exit(0)

    updated = 0
    for wm_id, info in inbox.items():
        # Normalize wm_id: strip "WM-" prefix
        clean_id = wm_id.replace("WM-", "").replace("WM", "").strip()
        status = patch_project(clean_id, info)
        if status in (200, 204):
            print(f"  OK  WM-{clean_id}")
            updated += 1
        else:
            print(f"  ERR WM-{clean_id} → HTTP {status}")

    print(f"\nSynced {updated} projects with inbox data.")

if __name__ == "__main__":
    main()
