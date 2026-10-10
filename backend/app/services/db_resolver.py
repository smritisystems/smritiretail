"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from fastapi import HTTPException, status
from typing import Optional, Any
import os, psycopg2, re

DB_HOST = os.getenv("POSTGRES_HOST") or os.getenv("DATABASE_HOST") or "localhost"
DB_PORT = os.getenv("POSTGRES_PORT") or 5432
DB_USER = os.getenv("POSTGRES_USER") or "postgres"
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD") or "postgres"
CONTROL_PLANE_DB_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/smritisys"

def generate_company_database_name(company_code: str) -> str:
    """
    Official Server-Side SMRITI Company Business Database Name Generator.
    Configurable alphanumeric company-code rules:
      1. Prefix MUST be exactly 'smriti'.
      2. No separator (underscore, hyphen, space).
      3. Company code MUST be 4 alphanumeric characters [A-Z0-9] or 3 numeric digits.
      4. 3-digit numeric code is normalized/padded to 4 digits (e.g. '001' -> '0001').
      5. Lowercase input is automatically normalized to uppercase (e.g. 'abc1' -> 'ABC1').
      6. '0000' and 'SYS0' are permanently reserved (forbidden).
    Examples:
      '001' -> 'smriti0001'
      'ABC1' -> 'smritiABC1'
      'MUM1' -> 'smritiMUM1'
    """
    if not company_code:
        raise ValueError("Company code is required.")

    code = str(company_code).strip().upper()

    if not code.isalnum():
        raise ValueError(f"Company code '{company_code}' contains invalid characters.")

    if len(code) == 3 and code.isdigit():
        code = code.zfill(4)
    elif len(code) != 4:
        raise ValueError(f"Company code '{company_code}' must be 4 alphanumeric characters [A-Z0-9] or 3 numeric digits.")

    if code == "0000":
        raise ValueError("Company code '0000' is permanently reserved and cannot be assigned.")

    if code == "SYS0":
        raise ValueError("Company code 'SYS0' is permanently reserved for SMRITI Control Plane.")

    return f"smriti{code}"


def validate_company_database_name(database_name: str) -> bool:
    """
    Validates if a database name adheres to the official naming standard: smriti<4-character-alphanumeric-code>
    or legacy 3-digit code smriti001.
    """
    if not database_name:
        return False
    if database_name == "smritisys":
        return False  # Control Plane DB is never a company target
    if not database_name.startswith("smriti"):
        return False
    code = database_name[6:]
    if code in ("0000", "SYS0"):
        return False  # Reserved
    if len(code) == 3 and code.isdigit():
        return True  # Legacy smriti001
    if len(code) == 4 and code.isalnum():
        return True
    return False

class CompanyDatabaseResolver:
    """
    Authoritative SMRITI Multi-Company Database Resolver.
    Resolves: User -> Tenant Context -> Company -> Company DB Registry -> Target Company DB (smriti<A-Z0-9>).
    """

    @staticmethod
    def resolve_company_database(user_id: str, company_id: str, company_code: Optional[str] = None, user_role: Optional[Any] = None) -> dict:
        """
        Resolves dynamic database routing for a given user and company_id.
        Fails closed on unauthorized access, suspended company, missing company_id, or invalid database registry.
        Never returns credential-bearing connection URLs in application payload.
        """
        if not company_id or not str(company_id).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company identifier is required for database resolution."
            )

        clean_company_id = str(company_id).strip()

        # 1. Connect READ-ONLY to Control Plane DB smritisys
        db_user = os.getenv("POSTGRES_USER") or "postgres"
        db_pass = os.getenv("POSTGRES_PASSWORD") or "postgres"
        db_port = int(os.getenv("POSTGRES_PORT") or 5432)
        ctrl_url = f"postgresql://{db_user}:{db_pass}@{DB_HOST}:{db_port}/smritisys"

        try:
            conn = psycopg2.connect(ctrl_url)
            cur = conn.cursor()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SMRITI Control Plane database unavailable."
            )

        try:
            # 2. Check if company exists in canonical companies table
            try:
                cur.execute("SELECT is_active, name FROM companies WHERE id = %s AND (is_deleted = false OR is_deleted IS NULL);", (clean_company_id,))
                company_row = cur.fetchone()
            except Exception:
                conn.rollback()
                company_row = None

            if not company_row:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Company '{clean_company_id}' is unknown or not registered."
                )

            is_active, company_name = company_row
            if not is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Company '{clean_company_id}' is inactive or suspended."
                )

            # 3. Verify User Assignment to Company or SYSADMIN Role
            is_sysadmin = False
            if user_role is not None:
                role_str = user_role.value if hasattr(user_role, "value") else str(user_role)
                if role_str.strip().upper() in ("SYSADMIN", "USERROLE.SYSADMIN"):
                    is_sysadmin = True

            if not is_sysadmin:
                # Query database users table for verified role if user_role was not explicitly passed
                try:
                    cur.execute("""
                        SELECT role FROM users 
                        WHERE (id = %s OR username = %s) AND (is_active = true OR is_active IS NULL) AND (is_deleted = false OR is_deleted IS NULL);
                    """, (user_id, user_id))
                    u_row = cur.fetchone()
                    if u_row and str(u_row[0]).strip().upper() in ("SYSADMIN", "USERROLE.SYSADMIN"):
                        is_sysadmin = True
                except Exception:
                    conn.rollback()

            assigned = False
            if is_sysadmin:
                assigned = True
            else:
                try:
                    cur.execute("""
                        SELECT 1 FROM user_company_assignments 
                        WHERE (user_id = %s OR user_id IN (SELECT id FROM users WHERE username = %s)) AND company_id = %s AND (is_active = true OR is_active IS NULL) AND (is_deleted = false OR is_deleted IS NULL);
                    """, (user_id, user_id, clean_company_id))
                    row = cur.fetchone()
                    if row:
                        assigned = True
                except Exception:
                    conn.rollback()
                    assigned = False

            if not assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User '{user_id}' is not authorized to access Company '{clean_company_id}'."
                )

            # 4. Resolve Company Database Registry Entry
            try:
                cur.execute("""
                    SELECT database_name, status, host_reference, port_reference, schema_version
                    FROM company_database_registries
                    WHERE company_id = %s;
                """, (clean_company_id,))
                registry_row = cur.fetchone()
            except Exception:
                conn.rollback()
                registry_row = None

            if not registry_row:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Company Database registry entry for '{clean_company_id}' not found. Access denied."
                )

            target_db, db_status, host, port, version = registry_row

            # 5. Validate Database Naming Standard & READY Status
            if target_db == "smritisys" or not validate_company_database_name(target_db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid company database name '{target_db}' resolved. The SMRITI control-plane database cannot be a company target."
                )

            if db_status != "READY":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Company Database for '{clean_company_id}' is in status '{db_status}'. Access denied."
                )

            # Validate company_code if explicitly provided
            derived_code = target_db[6:].upper() if target_db.startswith("smriti") else target_db.upper()
            if company_code and str(company_code).strip().upper() != derived_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Company code mismatch: expected '{derived_code}', got '{company_code}'."
                )

            return {
                "company_id": clean_company_id,
                "company_code": derived_code,
                "company_name": company_name,
                "database_name": target_db,
                "database_status": db_status,
                "host": host,
                "port": port,
                "schema_version": version
            }

        finally:
            conn.close()

company_db_resolver = CompanyDatabaseResolver()
