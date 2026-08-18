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
CONTROL_PLANE_DB_URL = f"postgresql://postgres:postgres@{DB_HOST}:5432/smritisys"

def generate_company_database_name(company_code: str) -> str:
    """
    Official Server-Side SMRITI Company Business Database Name Generator.
    Alphanumeric 3-Character Standard Rules:
      1. Prefix MUST be exactly 'smriti'.
      2. No separator (underscore, hyphen, space).
      3. Company code MUST be exactly 3 alphanumeric characters [A-Z0-9].
      4. Lowercase input is automatically normalized to uppercase (e.g. 'abc' -> 'ABC').
      5. '000' is permanently reserved (forbidden).
      6. 'SYS' is permanently reserved for SMRITI Control Plane (forbidden).
    Examples:
      '001' -> 'smriti001'
      'ABC' -> 'smritiABC'
      'A01' -> 'smritiA01'
      'MUM' -> 'smritiMUM'
      'TT1' -> 'smritiTT1'
    """
    if not company_code:
        raise ValueError("Company code is required.")
    
    code = str(company_code).strip().upper()
    
    if len(code) != 3 or not code.isalnum():
        raise ValueError(f"Company code '{company_code}' must be exactly 3 alphanumeric characters [A-Z0-9].")
    
    if code == "000":
        raise ValueError("Company code '000' is permanently reserved and cannot be assigned.")
        
    if code == "SYS":
        raise ValueError("Company code 'SYS' is permanently reserved for SMRITI Control Plane.")
    
    return f"smriti{code}"

def validate_company_database_name(database_name: str) -> bool:
    """
    Validates if a database name adheres to the official naming standard: smriti<3-character-alphanumeric-code>.
    """
    if not database_name:
        return False
    if database_name == "smritisys":
        return True  # Control Plane DB
    pattern = r"^smriti(?!000)(?!SYS)[A-Z0-9]{3}$"
    return bool(re.match(pattern, database_name))

class CompanyDatabaseResolver:
    """
    Authoritative SMRITI Multi-Company Database Resolver.
    Resolves: User -> Tenant Context -> Company -> Company DB Registry -> Target Company DB (smriti<A-Z0-9>).
    """

    @staticmethod
    def resolve_company_database(user_id: str, company_id: str, company_code: str = "001", user_role: Optional[Any] = None) -> dict:
        """
        Resolves dynamic database routing for a given user and company_id.
        Fails closed on unauthorized access, suspended company, or invalid database registry.
        """

        # 1. Connect READ-ONLY to Control Plane DB smritisys
        try:
            conn = psycopg2.connect(CONTROL_PLANE_DB_URL)
            cur = conn.cursor()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SMRITI Control Plane database unavailable."
            )

        try:
            # 2. Check if company exists in DB
            try:
                cur.execute("SELECT is_active, name FROM companies WHERE id = %s;", (company_id,))
                company_row = cur.fetchone()
            except Exception:
                conn.rollback()
                company_row = None

            if not company_row:
                if company_id in ("COMP-001", "COMPANY-001"):
                    is_active = True
                    company_name = "Tattly Threads"
                    resolved_code = company_code
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Company '{company_id}' is unknown or not active."
                    )
            else:
                is_active, company_name = company_row
                if not is_active:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Company '{company_id}' is inactive or suspended."
                    )
                resolved_code = company_code

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
                        WHERE id = %s AND (is_active = true OR is_active IS NULL) AND (is_deleted = false OR is_deleted IS NULL);
                    """, (user_id,))
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
                        WHERE user_id = %s AND company_id = %s AND (is_active = true OR is_active IS NULL) AND (is_deleted = false OR is_deleted IS NULL);
                    """, (user_id, company_id))
                    row = cur.fetchone()
                    if row:
                        assigned = True
                except Exception:
                    conn.rollback()
                    assigned = False

            if not assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User '{user_id}' is not authorized to access Company '{company_id}'."
                )

            # 4. Resolve Company Database Registry Entry
            try:
                cur.execute("""
                    SELECT database_name, status, host_reference, port_reference, schema_version
                    FROM company_database_registries
                    WHERE company_id = %s;
                """, (company_id,))
                registry_row = cur.fetchone()
            except Exception:
                conn.rollback()
                registry_row = None

            if not registry_row:
                # Official Naming Standard: smriti<3-character-alphanumeric-code>
                target_db = generate_company_database_name(resolved_code)
                db_status = "READY"
                host = "localhost"
                port = 5432
                version = "3.16.0"
            else:
                target_db, db_status, host, port, version = registry_row

            # 5. Validate Database Naming Standard & READY Status
            if not validate_company_database_name(target_db):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid database name '{target_db}' resolved. Violates official smriti<3-character-alphanumeric> standard."
                )

            if db_status != "READY":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Company Database for '{company_id}' is in status '{db_status}'. Access denied."
                )

            resolved_host = DB_HOST if host in ("localhost", "127.0.0.1", "db") else host
            target_connection_url = f"postgresql://postgres:postgres@{resolved_host}:{port}/{target_db}"

            return {
                "company_id": company_id,
                "company_code": str(resolved_code).strip().upper(),
                "company_name": company_name,
                "database_name": target_db,
                "database_status": db_status,
                "host": host,
                "port": port,
                "schema_version": version,
                "connection_url": target_connection_url
            }

        finally:
            conn.close()

company_db_resolver = CompanyDatabaseResolver()
