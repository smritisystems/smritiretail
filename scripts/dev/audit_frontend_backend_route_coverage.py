"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

audit_frontend_backend_route_coverage.py
==========================================
Development audit: cross-references all registered FastAPI backend routes
against all frontend fetch/apiFetchV1/apiFetch/axios calls found in src/.
Reports exact matches, unmatched frontend paths, potential /api/ -> /api/v1/
mappings, and backend routes never referenced by any frontend file.

Output is written to scripts/dev/frontend_backend_route_coverage.json.

Usage:
    python scripts/dev/audit_frontend_backend_route_coverage.py
"""

import os
import sys
import re
import json
from pathlib import Path

OUTPUT_FILE = "scripts/dev/frontend_backend_route_coverage.json"

# Configure environment for backend import
os.environ["JWT_SECRET_KEY"] = "testsecret123"
os.environ["SGIP_VAULT_MASTER_KEY"] = "testvaultkey"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["PYTHONPATH"] = os.pathsep.join(
    [os.environ.get("PYTHONPATH", ""), os.path.abspath("backend")]
)
sys.path.insert(0, "backend")

from app.main import app  # noqa: E402  (import after env setup)

_COMMENT_RE = re.compile(r"//.*?$|/\*.*?\*/", re.DOTALL | re.MULTILINE)

FETCH_PATTERNS = {
    "apiFetchV1": re.compile(r'apiFetchV1\(\s*["`\']([^"`\']*)["`\']'),
    "apiFetch": re.compile(r'apiFetch\(\s*["`\']([^"`\']*)["`\']'),
    "fetch": re.compile(r'fetch\(\s*["`\']([^"`\']*)["`\']'),
    "axios": re.compile(r'axios\.(?:get|post|put|delete|patch)\(\s*["`\']([^"`\']*)["`\']'),
}


def collect_backend_routes() -> set:
    return {r.path for r in app.routes if r.path.startswith("/api")}


def collect_frontend_api_calls(src_root: Path) -> dict:
    matches: dict = {}
    for path in sorted(src_root.rglob("*.ts*")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        text_stripped = re.sub(_COMMENT_RE, "", text)
        found = []
        for helper, regex in FETCH_PATTERNS.items():
            for match in regex.finditer(text_stripped):
                endpoint = match.group(1)
                if not endpoint.startswith("/"):
                    endpoint = "/" + endpoint
                if helper == "apiFetchV1":
                    endpoint = "/api/v1" + endpoint
                found.append((endpoint, helper))
        if found:
            matches[str(path)] = sorted(set(found))
    return matches


def main() -> None:
    backend_routes = collect_backend_routes()
    file_matches = collect_frontend_api_calls(Path("src"))
    frontend_paths = {ep for entries in file_matches.values() for ep, _ in entries}

    exact_matches = sorted(p for p in frontend_paths if p in backend_routes)
    unmatched = sorted(p for p in frontend_paths if p not in backend_routes)

    potential_mappings = []
    for path in unmatched:
        if path.startswith("/api/") and not path.startswith("/api/v1/"):
            candidate = "/api/v1" + path[4:]
            if candidate in backend_routes:
                potential_mappings.append((path, candidate))

    unused_backend_routes = sorted(r for r in backend_routes if r not in frontend_paths)

    report = {
        "backend_route_count": len(backend_routes),
        "frontend_path_count": len(frontend_paths),
        "exact_match_count": len(exact_matches),
        "unmatched_count": len(unmatched),
        "exact_matches": exact_matches[:200],
        "unmatched_sample": unmatched[:200],
        "potential_mappings": potential_mappings[:200],
        "frontend_files_with_api_calls": sorted(file_matches.keys()),
        "unused_backend_routes_count": len(unused_backend_routes),
        "unused_backend_routes_sample": unused_backend_routes[:200],
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(f"Coverage report written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
