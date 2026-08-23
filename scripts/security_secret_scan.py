"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.8.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import re
import subprocess
from pathlib import Path

# High-risk secret detection regexes
SECRET_PATTERNS = [
    (r"-----BEGIN (RSA|OPENSSH|EC|DSA|PGP|ENCRYPTED)?\s*PRIVATE KEY-----", "Private Cryptographic Key"),
    (r"-----BEGIN CERTIFICATE-----", "Committed X.509 Certificate"),
    (r"(?i)(cloudflare|cf)_[a-z0-9_-]*(token|key|secret)\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]", "Cloudflare Token/Key"),
    (r"(?i)(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*['\"][a-zA-Z0-9_\/+=]{20,}['\"]", "AWS Credential"),
    (r"(?i)(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}", "GitHub Token"),
    (r"(?i)(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})", "JWT Hardcoded Secret Token"),
    (r"(?i)api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]", "API Key Assignment"),
]

IGNORED_PATHS = [
    re.compile(r"^docs/"),
    re.compile(r"\.test\.(ts|tsx|js|py)$"),
    re.compile(r"^tests/"),
    re.compile(r"^backend/app/tests/"),
    re.compile(r"^scripts/"),
]

def run_scan():
    print("================================================================================")
    print("  SMRITI Pre-Commit Automated Secret & Private Key Scanner")
    print("================================================================================")

    # Get list of tracked/staged files
    try:
        res = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True)
        files = res.stdout.strip().splitlines()
    except Exception as e:
        print(f"[!] Error querying git repository files: {e}")
        return 1

    violations = []
    scanned_count = 0

    for file_path_str in files:
        file_path = Path(file_path_str)
        if not file_path.exists() or file_path.is_dir():
            continue

        # Skip binary files or ignored paths for pattern matching
        if any(p.search(file_path_str.replace("\\", "/")) for p in IGNORED_PATHS):
            continue

        # Check file extension
        if file_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".ico", ".gif", ".mp4", ".pdf", ".zip", ".tar", ".gz"]:
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            scanned_count += 1
            for line_idx, line in enumerate(content.splitlines(), start=1):
                for regex, rule_name in SECRET_PATTERNS:
                    if re.search(regex, line):
                        violations.append({
                            "file": file_path_str,
                            "line": line_idx,
                            "rule": rule_name,
                            "snippet": line.strip()[:60]
                        })
        except Exception as e:
            pass

    print(f"Scanned {scanned_count} repository files across codebase.")

    if violations:
        print(f"\n[CRITICAL SECURITY ALERT] Found {len(violations)} secret exposure violation(s):")
        for v in violations:
            print(f"  - [{v['rule']}] {v['file']}:{v['line']} -> {v['snippet']}")
        print("\n[!] COMMIT REJECTED: Purge hardcoded keys/secrets or add to .gitignore before committing.")
        return 1

    print("[+] PASS: No private keys, cloud tokens, or exposed secrets detected.")
    return 0

if __name__ == "__main__":
    sys.exit(run_scan())
