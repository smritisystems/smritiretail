"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Registration
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

load_dotenv(os.path.join(REPO_ROOT, ".env"))
db_conn = os.environ.get("DATABASE_URL") or "postgresql://postgres:postgres@localhost:5432/smritisys"
if "postgresql+asyncpg://" in db_conn:
    db_conn = db_conn.replace("postgresql+asyncpg://", "postgresql://")

print(f"Connecting to {db_conn.split('@')[-1]}...")
conn = psycopg2.connect(db_conn)
conn.autocommit = True
cur = conn.cursor()

cur.execute("SELECT * FROM architecture_domains LIMIT 10;")
domain_rows = cur.fetchall()
print(f"Available architecture_domains: {domain_rows}")
default_domain = domain_rows[0][0] if domain_rows else "CORE"
print(f"Using domain: {default_domain}")

# 1. Register Phase 1 Control Plane tables in architecture_entities
entities = [
    ("IDENTITY_REGISTRY", default_domain, "SmritiIdentityRegistry", "smritisys", "smriti_identity_registry", "backend/app/models/identity_registry.py", "backend/app/services/identity/engine.py", "/api/v1/identity"),
    ("NUMBERING_REGISTRY", default_domain, "SmritiNumberingRegistry", "smritisys", "smriti_numbering_registry", "backend/app/models/identity_registry.py", "backend/app/services/identity/code_generator.py", "/api/v1/identity"),
    ("IDENTITY_ALIAS", default_domain, "SmritiIdentityAlias", "smritisys", "smriti_identity_alias", "backend/app/models/identity_registry.py", "backend/app/services/identity/resolver.py", "/api/v1/identity"),
    ("IDENTITY_ALLOCATION_LOG", default_domain, "SmritiIdentityAllocationLog", "smritisys", "smriti_identity_allocation_log", "backend/app/models/identity_registry.py", "backend/app/services/identity/engine.py", "/api/v1/identity"),
]

for entity_key, domain_id, canonical_name, canonical_db, canonical_table, canonical_model, canonical_service, canonical_api in entities:
    cur.execute("SELECT entity_key FROM architecture_entities WHERE entity_key = %s;", (entity_key,))
    row = cur.fetchone()
    if row:
        cur.execute("""
            UPDATE architecture_entities SET
                domain_id = %s, canonical_name = %s, canonical_table = %s, canonical_model = %s,
                canonical_service = %s, canonical_api = %s, status = 'ACTIVE'
            WHERE entity_key = %s;
        """, (domain_id, canonical_name, canonical_table, canonical_model, canonical_service, canonical_api, entity_key))
    else:
        cur.execute("""
            INSERT INTO architecture_entities (
                entity_key, domain_id, canonical_name, canonical_db, canonical_table,
                canonical_model, canonical_service, canonical_api, status, version, owner
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE', 1, 'Jawahar Ramkripal Mallah');
        """, (entity_key, domain_id, canonical_name, canonical_db, canonical_table, canonical_model, canonical_service, canonical_api))
    print(f"Registered architecture_entity: {canonical_table} ({canonical_name})")

cur.execute("UPDATE architecture_entities SET domain_id = 'system' WHERE canonical_table LIKE 'smriti_%';")
print("Updated domain_id to system for smriti_% tables in architecture_entities.")

conn.close()

# 3. Issue Preflight Certificates for new files
new_files = [
    ("backend/app/api/v1/identity.py", "IDENTITY", "API_ENDPOINT", "identity.py"),
    ("backend/app/services/identity/uuid7.py", "IDENTITY", "UUID7_GENERATOR", "uuid7.py"),
    ("backend/app/services/identity/code_generator.py", "IDENTITY", "CODE_GENERATOR", "code_generator.py"),
    ("backend/app/services/identity/validator.py", "IDENTITY", "VALIDATOR", "validator.py"),
    ("backend/app/services/identity/resolver.py", "IDENTITY", "RESOLVER", "resolver.py"),
    ("backend/app/services/identity/engine.py", "IDENTITY", "FACADE", "engine.py"),
    ("backend/app/services/identity/__init__.py", "IDENTITY", "INIT", "__init__.py"),
    ("backend/app/schemas/identity.py", "IDENTITY", "SCHEMAS", "identity.py"),
    ("backend/app/models/identity_registry.py", "IDENTITY", "MODELS", "identity_registry.py"),
]

for rel_path, entity, cap, proposed_name in new_files:
    full_path = os.path.join(REPO_ROOT, rel_path)
    content = ""
    if os.path.exists(full_path):
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

    cert = PreflightCertificateManager.issue_certificate(
        entity=entity,
        capability="UNIFIED_IDENTITY_CONTROL_PLANE",
        asset_type="SOURCE_CODE",
        proposed_name=proposed_name,
        decision="APPROVED",
        canonical_owner=rel_path,
        target_file_path=rel_path,
        content=content,
        ttl_hours=168,
    )
    print(f"Issued certificate {cert['certificate_id']} for {rel_path}")

print("Phase 1 architecture registration completed successfully.")
