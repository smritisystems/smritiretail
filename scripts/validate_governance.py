"""
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
"""

import os
import sys
import re
import subprocess

def run_command(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error running {' '.join(args)}: {result.stderr}")
        return []
    return result.stdout.strip().split("\n")

def get_modified_files():
    # If running in GitHub Actions PR context
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if base_ref:
        # Fetch target branch first to ensure it's available
        subprocess.run(["git", "fetch", "origin", base_ref])
        return run_command(["git", "diff", "--name-only", f"origin/{base_ref}"])
    
    # Fallback to local HEAD vs parent commit
    return run_command(["git", "diff", "--name-only", "HEAD~1"])

def check_uadhp_headers(files):
    failed_files = []
    # Exclude system, cache, config, vendor, and compiled files
    exclude_patterns = [
        r"^node_modules/",
        r"^\.git/",
        r"^\.gemini/",
        r"^dist/",
        r"^build/",
        r"^\.venv/",
        r"^\.venv311/",
        r"^\.mypy_cache/",
        r"^\.pytest_cache/",
        r"^\.ruff_cache/",
        r"^package-lock\.json$",
        r"^package\.json$",
        r"^tsconfig\.json$",
        r"^vite\.config\.ts$",
        r"^vitest\.config\.ts$"
    ]
    
    check_extensions = (".py", ".ts", ".tsx", ".js", ".jsx", ".css", ".md")
    
    for f in files:
        if not os.path.exists(f) or not f.endswith(check_extensions):
            continue
        
        # Check excludes
        if any(re.match(pattern, f) for pattern in exclude_patterns):
            continue
            
        try:
            with open(f, "r", encoding="utf-8", errors="ignore") as file:
                content = "".join([file.readline() for _ in range(35)])
                
            has_project = "Project         : SMRITI Retail OS" in content or "Project      : SMRITI Retail OS" in content
            has_org = "Organization    : SmritiSys" in content or "Organization : SmritiSys" in content or "Organization : AITDL NETWORKS" in content
            has_copyright = "Copyright" in content
            
            if not (has_project and has_org and has_copyright):
                failed_files.append(f)
        except Exception as e:
            print(f"Failed to read file {f}: {e}")
            failed_files.append(f)
            
    return failed_files

def check_walkthrough_and_changelog(files):
    source_changed = False
    walkthrough_changed = False
    walkthrough_index_changed = False
    changelog_changed = False
    
    for f in files:
        if f.startswith(("backend/app/", "src/")) and f.endswith((".py", ".ts", ".tsx")):
            source_changed = True
        if f.startswith("docs/walkthrough/") and f.endswith(".md") and f != "docs/walkthrough/README.md":
            walkthrough_changed = True
        if f == "docs/walkthrough/README.md":
            walkthrough_index_changed = True
        if f == "CHANGELOG.md":
            changelog_changed = True
            
    errors = []
    if source_changed:
        if not walkthrough_changed:
            errors.append("Source code changed but no walkthrough file added/modified under docs/walkthrough/.")
        if not walkthrough_index_changed:
            errors.append("Source code changed but walkthrough master index docs/walkthrough/README.md not updated.")
        if not changelog_changed:
            errors.append("Source code changed but CHANGELOG.md not updated.")
            
    return errors

def check_adr_and_rfc_formatting(files):
    errors = []
    for f in files:
        if f.startswith("docs/architecture/adr/") and f.endswith(".md"):
            basename = os.path.basename(f)
            if not re.match(r"^ADR-\d{3}_.*\.md$", basename):
                errors.append(f"ADR file {f} does not match naming convention ADR-XXX_description.md")
        if f.startswith("docs/rfc/") and f.endswith(".md"):
            basename = os.path.basename(f)
            if not re.match(r"^RFC-\d{4}_.*\.md$", basename):
                errors.append(f"RFC file {f} does not match naming convention RFC-XXXX_description.md")
    return errors

def main():
    print("=== SMRITI Governance Validation Gate ===")
    
    modified_files = [f for f in get_modified_files() if f]
    print(f"Modified files detected: {len(modified_files)}")
    for f in modified_files:
        print(f" - {f}")
        
    if not modified_files:
        print("No modified files detected. Passing governance checks.")
        sys.exit(0)
        
    failed_headers = check_uadhp_headers(modified_files)
    doc_errors = check_walkthrough_and_changelog(modified_files)
    format_errors = check_adr_and_rfc_formatting(modified_files)
    
    has_failed = False
    
    if failed_headers:
        print("\n[FAIL] UADHP Header Check Failed for the following files (Missing SMRITI Author Block):")
        for f in failed_headers:
            print(f"  - {f}")
        has_failed = True
    else:
        print("\n[PASS] UADHP Header Check: Passed")
        
    if doc_errors:
        print("\n[FAIL] Walkthrough & Changelog Check Failed:")
        for err in doc_errors:
            print(f"  - {err}")
        has_failed = True
    else:
        print("\n[PASS] Walkthrough & Changelog Check: Passed")
        
    if format_errors:
        print("\n[FAIL] ADR & RFC Formatting Check Failed:")
        for err in format_errors:
            print(f"  - {err}")
        has_failed = True
    else:
        print("\n[PASS] ADR & RFC Formatting Check: Passed")
        
    if has_failed:
        print("\n=== Governance Validation Status: FAILED ===")
        sys.exit(1)
    else:
        print("\n=== Governance Validation Status: PASSED ===")
        sys.exit(0)

if __name__ == "__main__":
    main()
