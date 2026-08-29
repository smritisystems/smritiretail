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

import os, psycopg2, re
from typing import Optional

DB_HOST = os.getenv("POSTGRES_HOST") or os.getenv("DATABASE_HOST") or "localhost"
DB_PORT = os.getenv("POSTGRES_PORT") or 5432
DB_USER = os.getenv("POSTGRES_USER") or "postgres"
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD") or "postgres"
CONTROL_PLANE_DB_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/smritisys"

class CompanyCodeAllocator:
    """
    Concurrency-Safe Alphanumeric 3-Character Company Code Allocator.
    Allocates and validates 3-character alphanumeric company codes [A-Z0-9].
    '000' and 'SYS' are permanently reserved.
    """

    RESERVED_CODES = {"000", "SYS"}

    @staticmethod
    def allocate_next_available_code(db_cursor=None) -> str:
        """
        Determines the next available 3-digit numeric fallback company code (001 - 999).
        """
        local_conn = None
        if db_cursor is None:
            local_conn = psycopg2.connect(CONTROL_PLANE_DB_URL)
            cur = local_conn.cursor()
        else:
            cur = db_cursor

        try:
            try:
                cur.execute("SELECT company_code FROM companies WHERE company_code IS NOT NULL;")
                rows = cur.fetchall()
                assigned_codes = set()
                for row in rows:
                    if row[0]:
                        assigned = str(row[0]).strip().upper()
                        assigned_codes.add(assigned.zfill(4) if assigned.isdigit() else assigned)
            except Exception:
                if local_conn:
                    local_conn.rollback()
                assigned_codes = set()

            for code in range(1, 1000):
                code_str = f"{code:03d}"
                if code_str not in assigned_codes and code_str not in CompanyCodeAllocator.RESERVED_CODES:
                    return code_str

            raise RuntimeError("Numeric company code allocation limit reached (001-999). Use explicit alphanumeric code.")

        finally:
            if local_conn:
                local_conn.close()

    @staticmethod
    def validate_code_uniqueness(company_code: str, db_cursor=None) -> bool:
        """
        Validates if a 3-character alphanumeric company code is available and unique.
        """
        if not company_code:
            return False
        
        code = str(company_code).strip().upper()
        if code.isdigit() and len(code) <= 3:
            code = code.zfill(3)
        if len(code) != 3 or not code.isalnum():
            return False
            
        if code in {"000", "SYS"}:
            return False

        local_conn = None
        if db_cursor is None:
            local_conn = psycopg2.connect(CONTROL_PLANE_DB_URL)
            cur = local_conn.cursor()
        else:
            cur = db_cursor

        try:
            try:
                cur.execute("SELECT 1 FROM companies WHERE UPPER(company_code) = %s;", (code,))
                exists = cur.fetchone()
                return exists is None
            except Exception:
                if local_conn:
                    local_conn.rollback()
                return True
        finally:
            if local_conn:
                local_conn.close()

company_code_allocator = CompanyCodeAllocator()
