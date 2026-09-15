"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Certificate Engine
"""

import os
import sys
import json
import hashlib
import subprocess
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import psycopg2

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CERT_DIR = os.path.join(REPO_ROOT, ".architecture", "certificates")
DB_CONN = "postgresql://postgres:postgres@localhost:5432/smritisys"


def get_current_git_commit() -> str:
    try:
        res = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception:
        return "0000000000000000000000000000000000000000"


def calculate_content_hash(proposed_name: str, entity: str, capability: str, content: str = "") -> str:
    # Normalize line endings
    norm_content = content.replace("\r\n", "\n").strip()
    seed = f"{proposed_name}:{entity}:{capability}:{norm_content}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


class PreflightCertificateManager:
    @staticmethod
    def issue_certificate(
        entity: str,
        capability: str,
        asset_type: str,
        proposed_name: str,
        decision: str,
        canonical_owner: Optional[str] = None,
        target_file_path: Optional[str] = None,
        content: str = "",
        ttl_hours: int = 168,  # 7 days
    ) -> Dict[str, Any]:
        os.makedirs(CERT_DIR, exist_ok=True)
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=ttl_hours)

        date_prefix = now.strftime("%Y-%m%d")
        random_suffix = hashlib.sha256(f"{proposed_name}:{now.isoformat()}".encode("utf-8")).hexdigest()[:6].upper()
        cert_id = f"PF-{date_prefix}-{random_suffix}"

        # If file already exists, read its actual content to seed hash
        actual_content = content
        if target_file_path and os.path.exists(target_file_path) and not actual_content:
            try:
                with open(target_file_path, "r", encoding="utf-8", errors="ignore") as f:
                    actual_content = f.read()
            except Exception:
                pass

        content_hash = calculate_content_hash(proposed_name, entity, capability, actual_content)
        git_commit = get_current_git_commit()

        cert_data = {
            "certificate_id": cert_id,
            "entity": entity,
            "capability": capability,
            "asset_type": asset_type,
            "proposed_name": proposed_name,
            "target_file_path": target_file_path.replace("\\", "/") if target_file_path else None,
            "decision": decision,
            "canonical_owner": canonical_owner,
            "content_hash": content_hash,
            "git_commit": git_commit,
            "issued_at": now.isoformat(),
            "expires_at": expires.isoformat(),
            "status": "ISSUED",
        }

        # 1. Save local JSON file
        cert_file = os.path.join(CERT_DIR, f"{cert_id}.json")
        with open(cert_file, "w", encoding="utf-8") as f:
            json.dump(cert_data, f, indent=2)

        # 2. Save in smritisys DB
        try:
            conn = psycopg2.connect(DB_CONN)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO architecture_certificates (
                    certificate_id, entity, capability, asset_type, proposed_name,
                    target_file_path, decision, canonical_owner, content_hash,
                    git_commit, issued_at, expires_at, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (certificate_id) DO UPDATE SET
                    content_hash = EXCLUDED.content_hash,
                    expires_at = EXCLUDED.expires_at,
                    status = EXCLUDED.status;
            """, (
                cert_id, entity, capability, asset_type, proposed_name,
                cert_data["target_file_path"], decision, canonical_owner, content_hash,
                git_commit, now, expires, "ISSUED"
            ))
            conn.close()
        except Exception as e:
            print(f"[Warning] Failed to persist certificate to DB: {e}")

        return cert_data

    @staticmethod
    def verify_file_certificate(
        file_path: str,
        entity: str = None,
        capability: str = None,
        enforce_content_hash: bool = True,
        enforce_git_commit: bool = True,
        enforce_db_consistency: bool = True,
    ) -> Dict[str, Any]:
        norm_path = os.path.normpath(file_path).replace("\\", "/")
        file_name = os.path.basename(file_path)

        if not os.path.exists(CERT_DIR):
            return {"valid": False, "reason": "No certificates directory found (.architecture/certificates)."}

        now = datetime.now(timezone.utc)
        head_commit = get_current_git_commit()

        for cert_file in os.listdir(CERT_DIR):
            if not cert_file.endswith(".json"):
                continue
            cert_path = os.path.join(CERT_DIR, cert_file)
            try:
                with open(cert_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                cert_id = data.get("certificate_id")

                # Match target path or proposed filename
                target_path = data.get("target_file_path") or ""
                target_norm = os.path.normpath(target_path).replace("\\", "/") if target_path else ""

                path_matches = (target_norm == norm_path)
                name_matches = (data.get("proposed_name") == file_name)

                # Path or filename must match
                if not (path_matches or name_matches):
                    continue

                if entity and data.get("entity") != entity:
                    continue
                if capability and data.get("capability") != capability:
                    continue

                # 1. Expiration check
                cert_exp = datetime.fromisoformat(data["expires_at"])
                if now > cert_exp:
                    return {"valid": False, "reason": f"Preflight Certificate '{cert_id}' expired on {cert_exp}."}

                # 2. Git revision check
                if enforce_git_commit:
                    cert_commit = data.get("git_commit")
                    if cert_commit and head_commit != "0000000000000000000000000000000000000000":
                        if cert_commit != head_commit:
                            return {
                                "valid": False,
                                "reason": f"Git revision mismatch: Certificate '{cert_id}' was issued for commit {cert_commit[:8]}, but repo is at {head_commit[:8]}."
                            }

                # 3. Content hash check
                if enforce_content_hash and os.path.exists(file_path):
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        curr_content = f.read()
                    actual_hash = calculate_content_hash(data.get("proposed_name"), data.get("entity"), data.get("capability"), curr_content)
                    if data.get("content_hash") != actual_hash:
                        return {
                            "valid": False,
                            "reason": f"Content hash mismatch: File '{file_path}' content was altered after certificate '{cert_id}' was issued!"
                        }

                # 4. smritisys Database consistency check
                if enforce_db_consistency:
                    try:
                        conn = psycopg2.connect(DB_CONN)
                        cur = conn.cursor()
                        cur.execute("""
                            SELECT entity, capability, content_hash, git_commit, status
                            FROM architecture_certificates
                            WHERE certificate_id = %s;
                        """, (cert_id,))
                        db_row = cur.fetchone()
                        conn.close()

                        if not db_row:
                            return {
                                "valid": False,
                                "reason": f"Database consistency error: Certificate '{cert_id}' exists locally but is missing from smritisys control plane!"
                            }

                        db_ent, db_cap, db_hash, db_commit, db_status = db_row
                        if (db_ent != data.get("entity") or db_cap != data.get("capability") or
                                db_hash != data.get("content_hash") or db_commit != data.get("git_commit")):
                            return {
                                "valid": False,
                                "reason": f"Database tampering detected: Local certificate '{cert_id}' differs from smritisys control plane record!"
                            }

                        if db_status != "ISSUED" and db_status != "USED":
                            return {
                                "valid": False,
                                "reason": f"Certificate '{cert_id}' has revoked status in control plane: {db_status}."
                            }
                    except Exception as e:
                        print(f"[Warning] DB consistency check warning: {e}")

                # Everything verified
                return {
                    "valid": True,
                    "certificate_id": cert_id,
                    "decision": data["decision"],
                    "canonical_owner": data.get("canonical_owner"),
                    "certificate_data": data,
                }
            except Exception:
                continue

        return {"valid": False, "reason": f"No valid Preflight Certificate found for '{file_path}'."}
