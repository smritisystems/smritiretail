"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.92.0
Created      : 2026-10-18
Modified     : 2026-10-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Registration & Preflight Certification
"""

import os
import sys
from datetime import datetime, timezone
import psycopg2

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

_PG_PORT = os.getenv("POSTGRES_PORT", "2781")
DB_CONN = f"postgresql://postgres:postgres@localhost:{_PG_PORT}/smritisys"


def register_architecture():
    conn = psycopg2.connect(DB_CONN)
    cur = conn.cursor()
    now = datetime.now(timezone.utc)

    # 1. Register Architecture Entity (company)
    cur.execute(
        """
        INSERT INTO architecture_entities (
            entity_key, domain_id, canonical_name, canonical_db, canonical_table,
            canonical_model, canonical_service, canonical_api, canonical_ui, status, version, owner, created_at, modified_at
        ) VALUES (
            'company', 'system', 'Company Corporate Identity Master', 'smritisys', 'control_companies',
            'Company', 'backend/app/services/company_profile_service.py', '/api/v1/company/profile',
            'CompanyProfileStudio.tsx', 'ACTIVE', 1, 'Jawahar Ramkripal Mallah', %s, %s
        ) ON CONFLICT (entity_key) DO UPDATE SET
            status = 'ACTIVE', modified_at = %s;
        """,
        (now, now, now),
    )
    print("Registered architecture_entity 'company'.")

    # 2. Register Architecture Decision (ADR-042)
    cur.execute(
        """
        INSERT INTO architecture_decisions (
            decision_id, subject, canonical_owner, secondary_owner, classification,
            reason, scope, migration_plan, status, approved_by, approval_date,
            created_at, modified_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (decision_id) DO UPDATE SET
            subject = EXCLUDED.subject,
            canonical_owner = EXCLUDED.canonical_owner,
            secondary_owner = EXCLUDED.secondary_owner,
            classification = EXCLUDED.classification,
            reason = EXCLUDED.reason,
            status = EXCLUDED.status,
            approved_by = EXCLUDED.approved_by,
            modified_at = EXCLUDED.modified_at;
        """,
        (
            "ADR-042",
            "Enterprise Dynamic Seller Corporate Identity & Profile Governance Subsystem",
            "companies, branches, company_bank_accounts",
            "CompanyProfileService, SellerResolver, CompanyProfileStudio",
            "CANONICAL",
            "Authoritative Single System-of-Record for corporate identity, GST tax compliance, banking coordinates, and dynamic document branding",
            "FOUNDATION, TENANT, BILLING, PRINT ENGINE, PROCUREMENT",
            "Alembic v1537 applied across smritisys and smriti001",
            "APPROVED",
            "Jawahar Ramkripal Mallah",
            now,
            now,
            now,
        ),
    )
    print("Registered ADR-042.")

    # 2. Register Architecture Capability
    cur.execute(
        """
        INSERT INTO architecture_capabilities (
            capability_key, entity_key, name, business_intent,
            canonical_component, canonical_file, canonical_service, canonical_api,
            status, version, created_at, modified_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (capability_key) DO UPDATE SET
            canonical_component = EXCLUDED.canonical_component,
            canonical_file = EXCLUDED.canonical_file,
            canonical_service = EXCLUDED.canonical_service,
            canonical_api = EXCLUDED.canonical_api,
            status = EXCLUDED.status,
            modified_at = EXCLUDED.modified_at;
        """,
        (
            "company.profile_studio",
            "company",
            "Company Profile & Corporate Settings Studio",
            "Authoritative corporate identity, multi-branch, banking coordinates, GST compliance and document branding",
            "CompanyProfileStudio",
            "src/components/setup/CompanyProfileStudio.tsx",
            "backend/app/services/company_profile_service.py",
            "/api/v1/company/profile",
            "APPROVED",
            1,
            now,
            now,
        ),
    )
    print("Registered company.profile_studio capability.")

    conn.commit()
    conn.close()

    # 3. Issue Preflight Certificates for new assets
    new_assets = [
        {
            "entity": "company",
            "capability": "company.profile_studio",
            "asset_type": "api",
            "proposed_name": "company_profile.py",
            "target_file_path": "backend/app/api/v1/company_profile.py",
            "decision": "CREATE_NEW",
            "canonical_owner": "backend/app/api/v1/company_profile.py",
        },
        {
            "entity": "company",
            "capability": "company.profile_studio",
            "asset_type": "service",
            "proposed_name": "company_profile_service.py",
            "target_file_path": "backend/app/services/company_profile_service.py",
            "decision": "CREATE_NEW",
            "canonical_owner": "backend/app/services/company_profile_service.py",
        },
        {
            "entity": "company",
            "capability": "company.profile_studio",
            "asset_type": "component",
            "proposed_name": "CompanyProfileStudio.tsx",
            "target_file_path": "src/components/setup/CompanyProfileStudio.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/setup/CompanyProfileStudio.tsx",
        },
    ]

    for asset in new_assets:
        full_path = os.path.join(REPO_ROOT, asset["target_file_path"].replace("/", os.sep))
        content = ""
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()

        cert = PreflightCertificateManager.issue_certificate(
            entity=asset["entity"],
            capability=asset["capability"],
            asset_type=asset["asset_type"],
            proposed_name=asset["proposed_name"],
            decision=asset["decision"],
            canonical_owner=asset["canonical_owner"],
            target_file_path=asset["target_file_path"],
            content=content,
        )
        print(f"Issued certificate {cert['certificate_id']} for {asset['target_file_path']}")


if __name__ == "__main__":
    register_architecture()
