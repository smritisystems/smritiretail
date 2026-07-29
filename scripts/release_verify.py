#!/usr/bin/env python3
"""
Release verification script

Usage:
  python scripts/release_verify.py --repo owner/repo --tag v0.9.0-rc1 --outdir ./rc_downloads

Requires env var: GITHUB_TOKEN (if repo is private) or public repo access.

What it does:
- Downloads release assets from GitHub Release for given tag
- Verifies SHA256 checksums listed in SHA256SUMS
- Validates release-manifest.json contents
- Validates SBOM JSON files (SPDX and CycloneDX)
- Parses Trivy reports and fails on HIGH/CRITICAL vulnerabilities
- Pulls docker images and compares digests against image-digests.json
- Produces release-validation-report.md with summary

Designed to be re-run for every release candidate or GA release.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Dict, List, Tuple

try:
    from urllib.request import Request, urlopen
except Exception:
    print("urllib not available, aborting")
    raise


def api_get(url: str, token: str | None = None) -> dict:
    req = Request(url)
    if token:
        req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    with urlopen(req) as resp:
        return json.load(resp)


def download_url(url: str, dest: str, token: str | None = None) -> None:
    req = Request(url)
    if token:
        req.add_header("Authorization", f"token {token}")
    # allow GitHub to serve direct download
    with urlopen(req) as resp, open(dest, "wb") as out:
        shutil.copyfileobj(resp, out)


def sha256_of_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_checksums(dirpath: str, sums_file: str) -> Tuple[bool, List[str]]:
    failures: List[str] = []
    sums_path = os.path.join(dirpath, sums_file)
    if not os.path.exists(sums_path):
        return False, [f"{sums_file} not found"]
    with open(sums_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # format: <sha>  filename
            parts = line.split()
            if len(parts) < 2:
                continue
            expected = parts[0]
            filename = parts[-1]
            target = os.path.join(dirpath, filename)
            if not os.path.exists(target):
                failures.append(f"Missing file for checksum: {filename}")
                continue
            actual = sha256_of_file(target)
            if actual.lower() != expected.lower():
                failures.append(f"Checksum mismatch: {filename} expected {expected} got {actual}")
    return (len(failures) == 0), failures


def parse_trivy_report(path: str) -> Dict[str, int]:
    # Returns count by severity
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "UNKNOWN": 0}
    if not os.path.exists(path):
        return counts
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception:
            return counts
    for res in data.get("Results", []):
        for vuln in res.get("Vulnerabilities", []) or []:
            sev = vuln.get("Severity", "UNKNOWN").upper()
            if sev not in counts:
                counts[sev] = 0
            counts[sev] += 1
    return counts


def pull_and_get_digest(image: str) -> str | None:
    try:
        subprocess.run(["docker", "pull", image], check=True, stdout=subprocess.DEVNULL)
        out = subprocess.check_output(["docker", "inspect", "--format={{index .RepoDigests 0}}", image], text=True).strip()
        return out or None
    except subprocess.CalledProcessError:
        return None


def load_json(path: str) -> dict | None:
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def generate_report(outdir: str, results: Dict[str, Tuple[bool, List[str]]], summary: Dict[str, str]) -> None:
    rpt = []
    rpt.append("SMRITI Release Validation Report")
    rpt.append("=============================")
    rpt.append("")
    rpt.append(f"Version: {summary.get('version')}")
    rpt.append(f"Tag: {summary.get('tag')}")
    rpt.append(f"Repo: {summary.get('repo')}")
    rpt.append("")
    for k, (ok, details) in results.items():
        status = "PASS" if ok else "FAIL"
        rpt.append(f"{k}: {status}")
        for d in details:
            rpt.append(f"  - {d}")
        rpt.append("")
    overall = "PASS" if all(v[0] for v in results.values()) else "FAIL"
    rpt.append(f"Overall: {overall}")
    outpath = os.path.join(outdir, "release-validation-report.md")
    with open(outpath, "w", encoding="utf-8") as f:
        f.write("\n".join(rpt))
    print("Report written to", outpath)
    # Also write machine-readable JSON summary
    checks = {k: v[0] for k, v in results.items()}
    overall = all(v[0] for v in results.values())
    json_obj = {
        "version": summary.get("version"),
        "tag": summary.get("tag"),
        "repo": summary.get("repo"),
        "status": "PASS" if overall else "FAIL",
        "checks": checks,
        "details": {k: v[1] for k, v in results.items()},
    }
    json_path = os.path.join(outdir, "release-validation.json")
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(json_obj, jf, indent=2)
    print("JSON summary written to", json_path)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--repo", required=True, help="owner/repo")
    p.add_argument("--tag", required=True, help="release tag (eg v0.9.0-rc1)")
    p.add_argument("--outdir", default=None, help="download directory (defaults to ./rc_<tag>)")
    p.add_argument("--token", default=None, help="GitHub token (or set GITHUB_TOKEN env)")
    args = p.parse_args()

    token = args.token or os.environ.get("GITHUB_TOKEN")
    repo = args.repo
    tag = args.tag
    outdir = args.outdir or f"rc_{tag}"
    os.makedirs(outdir, exist_ok=True)

    print("Fetching release metadata from GitHub for", repo, tag)
    release_url = f"https://api.github.com/repos/{repo}/releases/tags/{tag}"
    try:
        release = api_get(release_url, token)
    except Exception as e:
        print("Failed to fetch release:", e)
        return 2

    assets = release.get("assets", [])
    if not assets:
        print("No assets found on release; ensure release was created and artifacts uploaded")
    downloaded = {}
    for a in assets:
        name = a.get("name")
        url = a.get("browser_download_url") or a.get("url")
        if not name or not url:
            continue
        dest = os.path.join(outdir, name)
        print("Downloading", name)
        try:
            download_url(url, dest, token)
            downloaded[name] = dest
        except Exception as e:
            print(f"Failed to download {name}: {e}")

    results: Dict[str, Tuple[bool, List[str]]] = {}

    # 1) Checksums
    ok, details = verify_checksums(outdir, "SHA256SUMS")
    results["Checksums"] = (ok, details)

    # 2) Manifest validation
    man_path = os.path.join(outdir, "release-manifest.json")
    manifest = load_json(man_path)
    man_details: List[str] = []
    man_ok = True
    if not manifest:
        man_ok = False
        man_details.append("release-manifest.json missing or invalid JSON")
    else:
        if manifest.get("version") != tag:
            man_ok = False
            man_details.append(f"manifest.version != tag ({manifest.get('version')} != {tag})")
        for key in ("docker_frontend", "docker_backend"):
            if key not in manifest:
                man_ok = False
                man_details.append(f"missing key in manifest: {key}")
    results["Manifest"] = (man_ok, man_details)

    # 3) SBOMs
    sbom_details: List[str] = []
    sbom_ok = True
    for sb in ("sbom.spdx.json", "sbom.cyclonedx.json"):
        path = os.path.join(outdir, sb)
        if not os.path.exists(path):
            sbom_ok = False
            sbom_details.append(f"missing {sb}")
        else:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    json.load(f)
            except Exception as e:
                sbom_ok = False
                sbom_details.append(f"invalid JSON in {sb}: {e}")
    results["SBOMs"] = (sbom_ok, sbom_details)

    # 4) Trivy reports
    trivy_ok = True
    trivy_details: List[str] = []
    for side in ("frontend", "backend"):
        fname = f"trivy-{side}-{tag}.json"
        path = os.path.join(outdir, fname)
        if not os.path.exists(path):
            # try alternative naming
            alt = f"trivy-{side}-{tag}.json"
            path = os.path.join(outdir, alt)
        if not os.path.exists(path):
            trivy_details.append(f"missing trivy report: {fname}")
            trivy_ok = False
            continue
        counts = parse_trivy_report(path)
        trivy_details.append(f"{side.capitalize()} - CRITICAL:{counts.get('CRITICAL',0)} HIGH:{counts.get('HIGH',0)} MEDIUM:{counts.get('MEDIUM',0)} LOW:{counts.get('LOW',0)}")
        if counts.get("CRITICAL", 0) > 0 or counts.get("HIGH", 0) > 0:
            trivy_ok = False
    results["Trivy"] = (trivy_ok, trivy_details)

    # 5) Docker registry verification
    dd_path = os.path.join(outdir, "image-digests.json")
    dig_details: List[str] = []
    dig_ok = True
    image_digests = load_json(dd_path) or {}
    # manifest docker tags
    if manifest:
        for label, img in (("frontend", manifest.get("docker_frontend")), ("backend", manifest.get("docker_backend"))):
            if not img:
                dig_ok = False
                dig_details.append(f"manifest missing docker tag for {label}")
                continue
            print("Pulling and inspecting", img)
            got = pull_and_get_digest(img)
            if not got:
                dig_ok = False
                dig_details.append(f"failed to pull or inspect {img}")
                continue
            recorded = image_digests.get(label) or image_digests.get(f"{label}") or image_digests.get(f"{label}_digest")
            # normalize
            if recorded:
                if recorded not in got and recorded.split('@')[-1] not in got:
                    dig_ok = False
                    dig_details.append(f"digest mismatch for {label}: recorded={recorded} actual={got}")
            dig_details.append(f"{label}: {got}")
    results["Image digests"] = (dig_ok, dig_details)

    summary = {"version": manifest.get("version") if manifest else tag, "tag": tag, "repo": repo}

    generate_report(outdir, results, summary)

    return 0 if all(v[0] for v in results.values()) else 3


if __name__ == "__main__":
    sys.exit(main())
