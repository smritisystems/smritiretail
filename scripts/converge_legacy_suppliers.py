"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-26
Modified     : 2026-10-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Universal Party & Legacy Supplier Convergence Tool
---------------------------------------------------------
Safely and idempotently reconciles unlinked legacy `suppliers` records into 
canonical `parties`, `party_roles`, `supplier_profiles`, `party_addresses`, and
records full audit lineage in `vendor_identity_migrations`.

Enforces deterministic disambiguation for collided codes (e.g., 'A', 'C'),
preserves all historical foreign key references, and defaults to --dry-run.
"""

import sys
import os
import argparse
import uuid
import json
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor


def extract_pan_from_gstin(gstin: str | None) -> str | None:
    if not gstin:
        return None
    clean = gstin.strip().upper()
    if len(clean) == 15 and clean[:2].isdigit():
        return clean[2:12]
    return None


def run_convergence(db_url: str, execute: bool = False, tenant_id: str = "smriti001"):
    print(f"==================================================================")
    print(f"SMRITI RETAIL OS — VENDOR CONVERGENCE & IDENTITY RECONCILIATION")
    print(f"Tenant Target : {tenant_id}")
    print(f"Execution Mode: {'COMMITTED EXECUTION (--execute)' if execute else 'DRY RUN ONLY (--dry-run)'}")
    print(f"Time          : {datetime.now(timezone.utc).isoformat()}")
    print(f"==================================================================")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Fetch Company ID from tenant
        cursor.execute("SELECT id FROM companies ORDER BY id LIMIT 1;")
        company_row = cursor.fetchone()
        company_id = company_row["id"] if company_row else None
        print(f"[*] Resolved Company Context ID: {company_id}")

        # 2. Existing Migration Lineage
        cursor.execute("SELECT legacy_supplier_id, party_id FROM vendor_identity_migrations;")
        migrated_rows = cursor.fetchall()
        migrated_supplier_ids = {r["legacy_supplier_id"]: r["party_id"] for r in migrated_rows}
        print(f"[*] Existing Migration Records : {len(migrated_supplier_ids)}")

        # 3. Existing Parties in Universal Party Master
        cursor.execute("SELECT id, party_code, legal_name, gstin FROM parties;")
        parties_rows = cursor.fetchall()
        existing_parties_by_code = {p["party_code"].upper(): p for p in parties_rows if p["party_code"]}
        all_party_codes = set(existing_parties_by_code.keys())
        print(f"[*] Existing Universal Parties : {len(parties_rows)}")

        # 4. Fetch All Legacy Suppliers
        cursor.execute("""
            SELECT id, name, code, gst_number, mobile, email, address, city, state, pincode, 
                   outstanding, is_active, company_id, branch_id 
            FROM suppliers 
            ORDER BY id;
        """)
        legacy_suppliers = cursor.fetchall()
        total_legacy = len(legacy_suppliers)
        print(f"[*] Total Legacy Suppliers     : {total_legacy}")

        # Identify unmigrated suppliers
        unmigrated = [s for s in legacy_suppliers if s["id"] not in migrated_supplier_ids]
        print(f"[*] Unmigrated Suppliers Found : {len(unmigrated)}")

        if not unmigrated:
            print("[+] All legacy suppliers are already converged. No actions required.")
            conn.rollback()
            return

        # 5. Planning and execution
        created_parties = 0
        linked_existing_parties = 0
        disambiguated_codes = 0
        created_addresses = 0
        migration_entries = 0

        for s in unmigrated:
            supp_id = s["id"]
            supp_name = (s["name"] or "Unnamed Supplier").strip()
            raw_code = (s["code"] or f"SUP-{supp_id[:6]}").strip().upper()
            gstin = (s["gst_number"] or "").strip().upper() or None
            pan = extract_pan_from_gstin(gstin)
            comp_id = s["company_id"] or company_id
            br_id = s["branch_id"]
            is_active = s["is_active"] if s["is_active"] is not None else True
            outstanding = float(s["outstanding"] or 0)

            disambiguation_note = None
            assigned_party_id = None

            # Case A: An existing Party already has this exact code
            if raw_code in all_party_codes:
                existing_p = existing_parties_by_code.get(raw_code)
                # Check if it represents the identical entity (matching GSTIN or name)
                if existing_p and (
                    (gstin and existing_p.get("gstin") == gstin) or 
                    (existing_p.get("legal_name", "").strip().lower() == supp_name.lower())
                ):
                    assigned_party_id = existing_p["id"]
                    linked_existing_parties += 1
                    disambiguation_note = f"Linked to existing Party {assigned_party_id} by matching code & identity ({raw_code})"
                else:
                    # Duplicate or collided code! Generate deterministic disambiguated code
                    disambiguated_codes += 1
                    counter = 2
                    candidate_code = f"{raw_code}-{counter}"
                    while candidate_code in all_party_codes:
                        counter += 1
                        candidate_code = f"{raw_code}-{counter}"
                    
                    target_code = candidate_code
                    all_party_codes.add(target_code)
                    disambiguation_note = f"Code collision for '{raw_code}'; disambiguated to '{target_code}'"

                    # Create new Party
                    party_id = f"pty_{uuid.uuid4().hex[:12]}"
                    assigned_party_id = party_id
                    created_parties += 1

                    cursor.execute("""
                        INSERT INTO parties (
                            id, uuid, party_code, party_type, legal_name, trade_name,
                            gstin, pan, email, mobile, address_line1, city, state, pincode,
                            country, status, company_id, branch_id, is_active, is_deleted, version
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s
                        );
                    """, (
                        party_id, str(uuid.uuid4()), target_code, "ORGANIZATION", supp_name, supp_name,
                        gstin, pan, s["email"], s["mobile"], s["address"], s["city"], s["state"], s["pincode"],
                        "India", "ACTIVE" if is_active else "INACTIVE", comp_id, br_id, is_active, False, 1
                    ))

                    # PartyRole SUPPLIER
                    cursor.execute("""
                        INSERT INTO party_roles (id, uuid, party_id, role_type, is_active, company_id, branch_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """, (f"prl_{uuid.uuid4().hex[:12]}", str(uuid.uuid4()), party_id, "SUPPLIER", True, comp_id, br_id))

                    # SupplierProfile
                    cursor.execute("""
                        INSERT INTO supplier_profiles (
                            id, uuid, party_id, supplier_type, payment_terms_days,
                            commercial_classification, tax_treatment, outstanding_liability,
                            company_id, branch_id
                        ) VALUES (
                            %s, %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s
                        );
                    """, (
                        f"spr_{uuid.uuid4().hex[:12]}", str(uuid.uuid4()), party_id, "DISTRIBUTOR", 120,
                        "APPROVED", "REGISTERED_REGULAR" if gstin else "UNREGISTERED", outstanding,
                        comp_id, br_id
                    ))

                    # PartyAddress
                    if s["address"] or s["city"]:
                        created_addresses += 1
                        cursor.execute("""
                            INSERT INTO party_addresses (
                                id, uuid, party_id, address_type, address_title,
                                address_line1, city, state, pincode, country, gstin, is_primary,
                                company_id, branch_id
                            ) VALUES (
                                %s, %s, %s, %s, %s,
                                %s, %s, %s, %s, %s, %s, %s,
                                %s, %s
                            );
                        """, (
                            f"pad_{uuid.uuid4().hex[:12]}", str(uuid.uuid4()), party_id, "BILLING", "Primary Office",
                            s["address"] or s["city"] or "Main Address", s["city"] or "Unknown", s["state"] or "Unknown",
                            s["pincode"] or "000000", "India", gstin, True,
                            comp_id, br_id
                        ))
            else:
                # Case B: Clean new code
                all_party_codes.add(raw_code)
                party_id = f"pty_{uuid.uuid4().hex[:12]}"
                assigned_party_id = party_id
                created_parties += 1

                cursor.execute("""
                    INSERT INTO parties (
                        id, uuid, party_code, party_type, legal_name, trade_name,
                        gstin, pan, email, mobile, address_line1, city, state, pincode,
                        country, status, company_id, branch_id, is_active, is_deleted, version
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s
                    );
                """, (
                    party_id, str(uuid.uuid4()), raw_code, "ORGANIZATION", supp_name, supp_name,
                    gstin, pan, s["email"], s["mobile"], s["address"], s["city"], s["state"], s["pincode"],
                    "India", "ACTIVE" if is_active else "INACTIVE", comp_id, br_id, is_active, False, 1
                ))

                # PartyRole SUPPLIER
                cursor.execute("""
                    INSERT INTO party_roles (id, uuid, party_id, role_type, is_active, company_id, branch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (f"prl_{uuid.uuid4().hex[:12]}", str(uuid.uuid4()), party_id, "SUPPLIER", True, comp_id, br_id))

                # SupplierProfile
                cursor.execute("""
                    INSERT INTO supplier_profiles (
                        id, uuid, party_id, supplier_type, payment_terms_days,
                        commercial_classification, tax_treatment, outstanding_liability,
                        company_id, branch_id
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s
                    );
                """, (
                    f"spr_{uuid.uuid4().hex[:12]}", str(uuid.uuid4()), party_id, "DISTRIBUTOR", 120,
                    "APPROVED", "REGISTERED_REGULAR" if gstin else "UNREGISTERED", outstanding,
                    comp_id, br_id
                ))

                # PartyAddress
                if s["address"] or s["city"]:
                    created_addresses += 1
                    cursor.execute("""
                        INSERT INTO party_addresses (
                            id, uuid, party_id, address_type, address_title,
                            address_line1, city, state, pincode, country, gstin, is_primary,
                            company_id, branch_id
                        ) VALUES (
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s,
                            %s, %s
                        );
                    """, (
                        f"pad_{uuid.uuid4().hex[:12]}", str(uuid.uuid4()), party_id, "BILLING", "Primary Office",
                        s["address"] or s["city"] or "Main Address", s["city"] or "Unknown", s["state"] or "Unknown",
                        s["pincode"] or "000000", "India", gstin, True,
                        comp_id, br_id
                    ))

            # Audit Lineage in vendor_identity_migrations
            vim_id = f"vim_{uuid.uuid4().hex[:12]}"
            details = {
                "legacy_name": supp_name,
                "legacy_code": raw_code,
                "gstin": gstin,
                "outstanding": outstanding,
            }
            if disambiguation_note:
                details["disambiguation"] = disambiguation_note

            cursor.execute("""
                INSERT INTO vendor_identity_migrations (
                    id, uuid, legacy_supplier_id, party_id, migration_status,
                    migration_reason, migrated_at, migrated_by, details_json,
                    company_id, branch_id, is_active, is_deleted, version
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                );
            """, (
                vim_id, str(uuid.uuid4()), supp_id, assigned_party_id, "COMPLETED",
                "LEGACY_CONVERGENCE", datetime.now(timezone.utc), "CONVERGENCE_TOOL",
                json.dumps(details), comp_id, br_id, True, False, 1
            ))
            migration_entries += 1

        print(f"\n==================== CONVERGENCE SUMMARY ====================")
        print(f"Total Legacy Processed        : {len(unmigrated)}")
        print(f"New Parties Created           : {created_parties}")
        print(f"Linked to Existing Parties    : {linked_existing_parties}")
        print(f"Code Collisions Disambiguated : {disambiguated_codes}")
        print(f"Party Addresses Created       : {created_addresses}")
        print(f"Audit Migration Entries Logged: {migration_entries}")
        print(f"=============================================================")

        if execute:
            conn.commit()
            print("[OK] TRANSACTION COMMITTED SUCCESSFULLY. Database updated.")
        else:
            conn.rollback()
            print("[!] DRY RUN COMPLETED. All transactions rolled back. 0 records modified.")

    except Exception as e:
        conn.rollback()
        print(f"[X] CONVERGENCE FAILED: {e}", file=sys.stderr)
        raise
    finally:
        cursor.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="SMRITI Legacy Supplier Convergence Tool")
    parser.add_argument("--execute", action="store_true", help="Commit changes to database (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry-run without writing (default)")
    parser.add_argument("--db-url", type=str, default="postgresql://postgres:postgres@localhost:2781/smriti001",
                        help="PostgreSQL connection URI")
    parser.add_argument("--tenant", type=str, default="smriti001", help="Tenant database name")

    args = parser.parse_args()
    execute_mode = args.execute and not args.dry_run
    run_convergence(args.db_url, execute=execute_mode, tenant_id=args.tenant)


if __name__ == "__main__":
    main()
