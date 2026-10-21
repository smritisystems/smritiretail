"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.1
Created      : 2026-08-20
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
import time
from typing import Any, Dict, List, Optional
from decimal import Decimal
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from ...core.config import settings
from ...models.auth import User
from ...api.v1.auth import get_current_user
from ...schemas.database_manager import (
    DatabaseSummary,
    TableSummary,
    ColumnSchema,
    TableSchemaResponse,
    TableDataResponse,
    MigrationInfo,
    SqlQueryRequest,
    SqlQueryResponse,
    GrnDateCorrectionItem,
    GrnDateRemediationRequest,
)

router = APIRouter()

# Whitelist allowed database naming pattern (alphanumeric and underscore only)
DB_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")
TABLE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")


def verify_sysadmin_role(user: User) -> None:
    """Strictly enforces SYSADMIN role authorization for all database management endpoints."""
    if not user or user.role != "SYSADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Database Manager requires SYSADMIN privileges.",
        )


def format_bytes(size_bytes: int) -> str:
    """Format bytes to human readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def categorize_table(table_name: str) -> str:
    """Heuristic categorizer for retail OS tables."""
    t = table_name.lower()
    if any(k in t for k in ["sales", "invoice", "pos", "shift", "cash", "tender", "coupon"]):
        return "Sales & POS"
    elif any(k in t for k in ["product", "item", "inventory", "stock", "barcode", "variant", "hsn", "attribute"]):
        return "Inventory & Catalog"
    elif any(k in t for k in ["purchase", "supplier", "vendor", "grn", "po_"]):
        return "Procurement"
    elif any(k in t for k in ["customer", "crm", "loyalty", "point", "reward", "referral"]):
        return "CRM & Customers"
    elif any(k in t for k in ["user", "role", "permission", "assignment", "tenant", "company_database"]):
        return "Security & Control Plane"
    elif any(k in t for k in ["master", "department", "designation", "bank", "terms", "series", "numbering"]):
        return "Masters & Config"
    elif any(k in t for k in ["report", "analytics", "schedule", "audit", "workflow", "event", "log"]):
        return "Reporting & Audit"
    return "General"


def sanitize_db_url(database_name: str) -> str:
    """Constructs an asyncpg database URL for a valid database name using configured credentials."""
    if not DB_NAME_PATTERN.match(database_name):
        raise HTTPException(status_code=400, detail="Invalid database name format.")

    # Base URL parsing
    raw_url = str(settings.DATABASE_URL)
    # Replace database name at the end
    # postgresql://user:pass@host:port/dbname
    base_prefix = raw_url.rsplit("/", 1)[0]
    if base_prefix.startswith("postgresql://"):
        base_prefix = base_prefix.replace("postgresql://", "postgresql+asyncpg://")
    elif not base_prefix.startswith("postgresql+asyncpg://"):
        base_prefix = f"postgresql+asyncpg://{base_prefix.split('://', 1)[-1]}"

    return f"{base_prefix}/{database_name}"


def json_serializable(val: Any) -> Any:
    """Convert database values into JSON-serializable types."""
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, bytes):
        return val.hex()
    return val


@router.get("/databases", response_model=List[DatabaseSummary], summary="List All PostgreSQL Databases")
async def list_databases(current_user: User = Depends(get_current_user)):
    """Discovers all active PostgreSQL databases with size and table count telemetry."""
    verify_sysadmin_role(current_user)

    url = sanitize_db_url("postgres")
    engine = create_async_engine(url, echo=False)
    results = []

    try:
        async with engine.connect() as conn:
            q = text("""
                SELECT 
                    datname,
                    pg_database_size(datname) as size_bytes
                FROM pg_database
                WHERE datistemplate = false
                ORDER BY datname ASC;
            """)
            res = await conn.execute(q)
            db_rows = res.fetchall()

        for r in db_rows:
            db_name = r.datname
            size_b = int(r.size_bytes or 0)
            
            # Count tables in target DB
            table_cnt = 0
            try:
                target_url = sanitize_db_url(db_name)
                t_engine = create_async_engine(target_url, echo=False)
                async with t_engine.connect() as t_conn:
                    t_res = await t_conn.execute(text("""
                        SELECT count(*) 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
                    """))
                    table_cnt = t_res.scalar() or 0
                await t_engine.dispose()
            except Exception:
                table_cnt = 0

            is_cp = (db_name == "smritisys")
            is_tenant = db_name.startswith("smriti0") or db_name.startswith("smriti_")
            is_active = (db_name == "smriti001" or db_name == "smritisys")

            results.append(DatabaseSummary(
                name=db_name,
                size_bytes=size_b,
                size_pretty=format_bytes(size_b),
                table_count=table_cnt,
                is_active=is_active,
                is_control_plane=is_cp,
                is_tenant=is_tenant
            ))
    finally:
        await engine.dispose()

    return results


@router.get("/tables", response_model=List[TableSummary], summary="List Tables in Specified Database")
async def list_tables(
    database: str = Query("smriti001", description="Target database name"),
    current_user: User = Depends(get_current_user)
):
    """Lists all user tables in the selected database with live row counts and disk usage."""
    verify_sysadmin_role(current_user)

    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)
    results = []

    try:
        async with engine.connect() as conn:
            q = text("""
                SELECT 
                    t.table_name,
                    COALESCE(pg_total_relation_size(quote_ident(t.table_name)), 0) as size_bytes,
                    (
                        SELECT count(*) 
                        FROM information_schema.columns c 
                        WHERE c.table_name = t.table_name AND c.table_schema = 'public'
                    ) as column_count
                FROM information_schema.tables t
                WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name ASC;
            """)
            res = await conn.execute(q)
            table_rows = res.fetchall()

            for r in table_rows:
                t_name = r.table_name
                # Get exact row count
                try:
                    count_res = await conn.execute(text(f'SELECT count(*) FROM "{t_name}";'))
                    row_cnt = count_res.scalar() or 0
                except Exception:
                    row_cnt = 0

                size_b = int(r.size_bytes or 0)
                results.append(TableSummary(
                    name=t_name,
                    row_count=row_cnt,
                    size_bytes=size_b,
                    size_pretty=format_bytes(size_b),
                    column_count=int(r.column_count or 0),
                    category=categorize_table(t_name)
                ))
    finally:
        await engine.dispose()

    return results


@router.get("/tables/{table_name}/schema", response_model=TableSchemaResponse, summary="Get Table Schema and Structure")
async def get_table_schema(
    table_name: str,
    database: str = Query("smriti001", description="Target database name"),
    current_user: User = Depends(get_current_user)
):
    """Inspects detailed column schema, data types, primary keys, foreign key relations, and indexes."""
    verify_sysadmin_role(current_user)

    if not TABLE_NAME_PATTERN.match(table_name):
        raise HTTPException(status_code=400, detail="Invalid table name format.")

    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)

    try:
        async with engine.connect() as conn:
            # 1. Fetch Primary Keys
            pk_q = text("""
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_name = :t_name
                  AND tc.table_schema = 'public';
            """)
            pk_res = await conn.execute(pk_q, {"t_name": table_name})
            primary_keys = [r[0] for r in pk_res.fetchall()]

            # 2. Fetch Foreign Keys
            fk_q = text("""
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    rc.delete_rule
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                JOIN information_schema.referential_constraints rc
                  ON rc.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = :t_name
                  AND tc.table_schema = 'public';
            """)
            fk_res = await conn.execute(fk_q, {"t_name": table_name})
            fk_rows = fk_res.fetchall()
            fk_map = {r.column_name: r for r in fk_rows}
            foreign_keys = [
                {
                    "column_name": r.column_name,
                    "foreign_table": r.foreign_table_name,
                    "foreign_column": r.foreign_column_name,
                    "delete_rule": r.delete_rule,
                }
                for r in fk_rows
            ]

            # 3. Fetch Indexes
            idx_q = text("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = :t_name;
            """)
            idx_res = await conn.execute(idx_q, {"t_name": table_name})
            indexes = [{"name": r.indexname, "definition": r.indexdef} for r in idx_res.fetchall()]

            # 4. Fetch Columns
            col_q = text("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :t_name
                ORDER BY ordinal_position ASC;
            """)
            col_res = await conn.execute(col_q, {"t_name": table_name})
            columns = []
            for c in col_res.fetchall():
                c_name = c.column_name
                is_pk = c_name in primary_keys
                is_fk = c_name in fk_map
                fk_info = fk_map.get(c_name)

                columns.append(ColumnSchema(
                    name=c_name,
                    data_type=c.data_type,
                    is_nullable=(c.is_nullable == "YES"),
                    default_value=str(c.column_default) if c.column_default is not None else None,
                    max_length=c.character_maximum_length,
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    foreign_table=fk_info.foreign_table_name if fk_info else None,
                    foreign_column=fk_info.foreign_column_name if fk_info else None,
                    delete_rule=fk_info.delete_rule if fk_info else None,
                ))

            return TableSchemaResponse(
                table_name=table_name,
                database=database,
                columns=columns,
                primary_keys=primary_keys,
                foreign_keys=foreign_keys,
                indexes=indexes,
            )
    finally:
        await engine.dispose()


@router.get("/tables/{table_name}/data", response_model=TableDataResponse, summary="Browse Paginated Table Records")
async def get_table_data(
    table_name: str,
    database: str = Query("smriti001", description="Target database name"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
    search: Optional[str] = Query(None, description="Search keyword across text columns"),
    sort_by: Optional[str] = Query(None, description="Column to sort by"),
    sort_order: Optional[str] = Query("asc", description="Sort order: asc or desc"),
    current_user: User = Depends(get_current_user)
):
    """Fetches paginated data records with search, filtering, and column sorting."""
    verify_sysadmin_role(current_user)

    if not TABLE_NAME_PATTERN.match(table_name):
        raise HTTPException(status_code=400, detail="Invalid table name format.")

    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)

    try:
        async with engine.connect() as conn:
            # 1. Fetch Column Names
            col_q = text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = :t_name
                ORDER BY ordinal_position ASC;
            """)
            col_res = await conn.execute(col_q, {"t_name": table_name})
            col_rows = col_res.fetchall()
            col_names = [r.column_name for r in col_rows]
            text_cols = [r.column_name for r in col_rows if "char" in r.data_type or "text" in r.data_type]

            if not col_names:
                raise HTTPException(status_code=404, detail=f"Table '{table_name}' does not exist in {database}.")

            # 2. Build WHERE clause for search
            where_clauses = []
            params: Dict[str, Any] = {}
            if search and text_cols:
                search_parts = [f'"{col}"::text ILIKE :search_term' for col in text_cols[:8]]  # search top text cols
                where_clauses.append(f"({' OR '.join(search_parts)})")
                params["search_term"] = f"%{search.strip()}%"

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            # 3. Total Rows Count
            count_q = text(f'SELECT count(*) FROM "{table_name}" {where_str};')
            count_res = await conn.execute(count_q, params)
            total_rows = count_res.scalar() or 0

            # 4. Sorting & Pagination
            order_by_clause = ""
            if sort_by and sort_by in col_names:
                order_dir = "DESC" if sort_order and sort_order.lower() == "desc" else "ASC"
                order_by_clause = f'ORDER BY "{sort_by}" {order_dir}'
            elif "created_at" in col_names:
                order_by_clause = 'ORDER BY "created_at" DESC'
            elif "id" in col_names:
                order_by_clause = 'ORDER BY "id" ASC'

            offset = (page - 1) * limit
            data_q = text(f'SELECT * FROM "{table_name}" {where_str} {order_by_clause} LIMIT :limit OFFSET :offset;')
            params["limit"] = limit
            params["offset"] = offset

            data_res = await conn.execute(data_q, params)
            raw_rows = data_res.fetchall()

            rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col in enumerate(col_names):
                    row_dict[col] = json_serializable(r[idx])
                rows.append(row_dict)

            total_pages = (total_rows + limit - 1) // limit if total_rows > 0 else 1

            return TableDataResponse(
                table_name=table_name,
                database=database,
                columns=col_names,
                rows=rows,
                total_rows=total_rows,
                page=page,
                limit=limit,
                total_pages=total_pages,
            )
    finally:
        await engine.dispose()


@router.get("/migrations", response_model=MigrationInfo, summary="Get Database Alembic Migration Status")
async def get_migrations(
    database: str = Query("smriti001", description="Target database name"),
    current_user: User = Depends(get_current_user)
):
    """Inspects the current Alembic revision in the target database."""
    verify_sysadmin_role(current_user)

    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)

    try:
        async with engine.connect() as conn:
            check_alem = await conn.execute(text("SELECT to_regclass('alembic_version');"))
            if not check_alem.scalar():
                return MigrationInfo(
                    current_revision=None,
                    head_revision="v1338_company_isolated_barcodes",
                    is_up_to_date=False,
                    database=database
                )

            res = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1;"))
            rev = res.scalar()

            head_rev = "v1338_company_isolated_barcodes"
            is_up = (rev == head_rev)

            return MigrationInfo(
                current_revision=rev,
                head_revision=head_rev,
                is_up_to_date=is_up,
                database=database
            )
    finally:
        await engine.dispose()


@router.post("/query", response_model=SqlQueryResponse, summary="Execute Safe Read-Only SQL Query")
async def execute_query(
    req: SqlQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Executes an administrative read-only SELECT query against the specified database.
    Destructive DDL/DML statements are strictly prohibited.
    Results are hard-capped at 1,000 rows server-side to prevent data exfiltration.
    Requires SYSADMIN role.
    """
    verify_sysadmin_role(current_user)

    raw_query = req.query.strip()
    database = req.database or "smriti001"

    # Validation: Must start with SELECT or WITH
    normalized = raw_query.upper().strip()
    if not (normalized.startswith("SELECT") or normalized.startswith("WITH") or normalized.startswith("EXPLAIN")):
        raise HTTPException(
            status_code=400,
            detail="Forbidden query type. Only read-only queries (SELECT, WITH, EXPLAIN) are permitted."
        )

    # Disallow destructive keywords anywhere in statement
    disallowed_keywords = [
        "DROP", "DELETE", "TRUNCATE", "UPDATE", "INSERT", "ALTER",
        "CREATE", "GRANT", "REVOKE", "VACUUM", "COPY", "EXECUTE"
    ]
    words = re.findall(r"\b[A-Za-z_]+\b", normalized)
    for kw in disallowed_keywords:
        if kw in words:
            raise HTTPException(
                status_code=400,
                detail=f"Forbidden keyword '{kw}' detected. Only read-only queries are permitted in DB Studio."
            )

    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)
    start_time = time.time()

    try:
        async with engine.connect() as conn:
            # Enforce max limit — server-side hard cap at 1,000 rows to prevent data exfiltration.
            # The client-requested max_rows is honoured only up to this ceiling.
            _MAX_ROWS_HARD_CAP = 1_000
            max_r = min(req.max_rows or 50, _MAX_ROWS_HARD_CAP)
            exec_q = f"{raw_query.rstrip(';')} LIMIT {max_r};"

            res = await conn.execute(text(exec_q))
            col_names = list(res.keys()) if res.returns_rows else []
            raw_rows = res.fetchall() if res.returns_rows else []

            rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col in enumerate(col_names):
                    row_dict[col] = json_serializable(r[idx])
                rows.append(row_dict)

            elapsed_ms = (time.time() - start_time) * 1000.0

            return SqlQueryResponse(
                success=True,
                database=database,
                query=raw_query,
                columns=col_names,
                rows=rows,
                row_count=len(rows),
                execution_time_ms=round(elapsed_ms, 2)
            )
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000.0
        return SqlQueryResponse(
            success=False,
            database=database,
            query=raw_query,
            columns=[],
            rows=[],
            row_count=0,
            execution_time_ms=round(elapsed_ms, 2),
            error=str(e)
        )
    finally:
        await engine.dispose()


@router.post(
    "/admin-rename-cancelled-invoices",
    summary="SYSADMIN: Rename cancelled invoice_no to free unique-key slot for reissue",
)
async def admin_rename_cancelled_invoices(
    invoice_ids: List[str],
    database: str = "smriti001",
    current_user: User = Depends(get_current_user),
):
    """
    SYSADMIN-only. For each supplied invoice UUID that has status='Cancelled'
    in sales_invoices, renames invoice_no to '{original}_VOID_{id[:8]}' to
    free the unique (company_id, invoice_no) constraint slot for reissue.
    Works regardless of is_deleted value (handles both True and False variants).
    """
    verify_sysadmin_role(current_user)
    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)
    freed, not_found, errors = [], [], []
    try:
        async with engine.begin() as conn:
            for inv_id in invoice_ids:
                if not re.match(r'^[0-9a-f\-]{20,36}$', inv_id, re.IGNORECASE):
                    errors.append(f"Invalid ID format: {inv_id}")
                    continue
                sel = text(
                    "SELECT id, invoice_no FROM sales_invoices "
                    "WHERE id = :iid AND status = 'Cancelled'"
                )
                res = await conn.execute(sel, {"iid": inv_id})
                row = res.fetchone()
                if not row:
                    not_found.append(inv_id)
                    continue
                orig_no = row[1]
                new_no  = f"{orig_no}_VOID_{inv_id[:8]}"
                upd = text(
                    "UPDATE sales_invoices SET invoice_no = :new_no, "
                    "is_deleted = true, modified_at = NOW() "
                    "WHERE id = :iid AND status = 'Cancelled'"
                )
                await conn.execute(upd, {"new_no": new_no, "iid": inv_id})
                freed.append({"id": inv_id, "old": orig_no, "new": new_no})
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        await engine.dispose()
    return {
        "success": True,
        "freed":     freed,
        "not_found": not_found,
        "errors":    errors,
        "message":   f"Renamed {len(freed)} cancelled invoice(s); {len(not_found)} not found.",
    }


@router.post(
    "/admin-hard-delete-invoices",
    summary="SYSADMIN: Hard-delete invoice records by ID (irreversible)",
)
async def admin_hard_delete_invoices(
    invoice_ids: List[str],
    database: str = "smriti001",
    current_user: User = Depends(get_current_user),
):
    """
    SYSADMIN-only. Permanently removes sales_invoice and related line-item
    records for the given IDs. Only operates on records that are already
    Cancelled. This is irreversible — use only for correction-reimport workflows.
    """
    verify_sysadmin_role(current_user)
    url = sanitize_db_url(database)
    engine = create_async_engine(url, echo=False)
    deleted, skipped, errors = [], [], []
    try:
        async with engine.begin() as conn:
            for inv_id in invoice_ids:
                if not re.match(r'^[0-9a-f\-]{20,36}$', inv_id, re.IGNORECASE):
                    errors.append(f"Invalid ID: {inv_id}")
                    continue
                chk = text("SELECT id, invoice_no, status FROM sales_invoices WHERE id = :iid")
                res = await conn.execute(chk, {"iid": inv_id})
                row = res.fetchone()
                if not row:
                    skipped.append(inv_id)
                    continue
                if row[2] not in ("Cancelled", "CANCELLED"):
                    skipped.append(f"{inv_id} (status={row[2]}, not cancelled)")
                    continue
                await conn.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :iid"), {"iid": inv_id})
                await conn.execute(text("DELETE FROM sales_invoices WHERE id = :iid"), {"iid": inv_id})
                deleted.append({"id": inv_id, "invoice_no": row[1]})
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        await engine.dispose()
    return {
        "success": True,
        "deleted": deleted,
        "skipped": skipped,
        "errors":  errors,
        "message": f"Hard-deleted {len(deleted)} invoice(s); {len(skipped)} skipped (non-cancelled).",
    }


@router.post(
    "/admin-remediate-grn-dates",
    summary="SYSADMIN: Remediate historical GRN and stock movement created_at timestamps",
)
async def admin_remediate_grn_dates(
    req: GrnDateRemediationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    SYSADMIN-only. Remediates historical Goods Receipt Note (GRN) created_at timestamps
    and downstream stock_movements created_at timestamps using authoritative vendor bill dates.
    Strictly preserves GRN numbers, IDs, items, costs, taxes, and status (RECEIVED).
    Does NOT amend, cancel, or recreate submitted GRNs or stock records.
    Backs up all affected rows before mutating when dry_run=False.
    """
    verify_sysadmin_role(current_user)
    if not DB_NAME_PATTERN.match(req.database):
        raise HTTPException(status_code=400, detail="Invalid database name format.")

    url = sanitize_db_url(req.database)
    engine = create_async_engine(url, echo=False)

    audit_log = []
    not_found = []
    errors = []
    total_movements_affected = 0

    try:
        if req.dry_run:
            async with engine.connect() as conn:
                for item in req.corrections:
                    sel = text("""
                        SELECT id::text, receipt_no, status, created_at, notes
                        FROM purchase_receipts
                        WHERE receipt_no = :rno OR id::text = :rid
                        LIMIT 1;
                    """)
                    res = await conn.execute(sel, {"rno": item.receipt_no, "rid": item.receipt_id or item.receipt_no})
                    row = res.fetchone()
                    if not row:
                        not_found.append(item.receipt_no)
                        continue

                    grn_id = str(row[0])
                    actual_rno = row[1]
                    cur_ts = row[3]

                    sm_res = await conn.execute(
                        text("SELECT count(*) FROM stock_movements WHERE reference_doc_id::text = :gid OR reference_doc_id::text = :rno"),
                        {"gid": grn_id, "rno": actual_rno}
                    )
                    sm_count = sm_res.scalar() or 0
                    total_movements_affected += sm_count

                    audit_log.append({
                        "grn_id": grn_id,
                        "receipt_no": actual_rno,
                        "current_created_at": cur_ts.isoformat() if cur_ts else None,
                        "target_created_at": item.target_date,
                        "stock_movements_count": sm_count,
                        "status": "READY_FOR_REMEDIATION",
                    })

            return {
                "success": True,
                "mode": "DRY_RUN",
                "database": req.database,
                "remediations_planned": len(audit_log),
                "total_movements_planned": total_movements_affected,
                "not_found": not_found,
                "errors": errors,
                "planned_items": audit_log,
                "message": f"[DRY RUN] Audit complete. {len(audit_log)} GRNs matched ({total_movements_affected} stock movements planned), {len(not_found)} not found.",
            }
        else:
            # LIVE MUTATION WITH BACKUP IN DEDICATED TRANSACTION
            async with engine.begin() as conn:
                # 1. Ensure backup tables exist
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS _backup_purchase_receipts_grn_date (
                        backup_id serial PRIMARY KEY,
                        backup_at timestamptz DEFAULT NOW(),
                        grn_id varchar(64),
                        receipt_no varchar(128),
                        old_created_at timestamptz,
                        new_created_at timestamptz
                    );
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS _backup_stock_movements_grn_date (
                        backup_id serial PRIMARY KEY,
                        backup_at timestamptz DEFAULT NOW(),
                        movement_id varchar(64),
                        reference_doc_id varchar(64),
                        old_created_at timestamptz,
                        new_created_at timestamptz
                    );
                """))

                for item in req.corrections:
                    sel = text("""
                        SELECT id, receipt_no, status, created_at
                        FROM purchase_receipts
                        WHERE receipt_no = :rno OR id::text = :rid
                        FOR UPDATE;
                    """)
                    res = await conn.execute(sel, {"rno": item.receipt_no, "rid": item.receipt_id or item.receipt_no})
                    row = res.fetchone()
                    if not row:
                        not_found.append(item.receipt_no)
                        continue

                    raw_grn_id = row[0]
                    actual_rno = row[1]
                    old_ts = row[3]
                    str_grn_id = str(raw_grn_id)

                    # Parse target timestamp
                    raw_target = item.target_date.strip().replace("Z", "+00:00")
                    new_ts = datetime.fromisoformat(raw_target)

                    # Backup existing state
                    await conn.execute(text("""
                        INSERT INTO _backup_purchase_receipts_grn_date (grn_id, receipt_no, old_created_at, new_created_at)
                        VALUES (:gid, :rno, :old_ts, :new_ts);
                    """), {"gid": str_grn_id, "rno": actual_rno, "old_ts": old_ts, "new_ts": new_ts})

                    await conn.execute(text("""
                        INSERT INTO _backup_stock_movements_grn_date (movement_id, reference_doc_id, old_created_at, new_created_at)
                        SELECT id::text, reference_doc_id::text, created_at, :new_ts
                        FROM stock_movements
                        WHERE reference_doc_id::text = :gid OR reference_doc_id::text = :rno;
                    """), {"gid": str_grn_id, "rno": actual_rno, "new_ts": new_ts})

                    # Update purchase_receipts created_at and modified_at
                    await conn.execute(text("""
                        UPDATE purchase_receipts
                        SET created_at = :new_ts, modified_at = NOW()
                        WHERE id = :raw_gid;
                    """), {"new_ts": new_ts, "raw_gid": raw_grn_id})

                    # Update stock_movements created_at and modified_at
                    upd_sm = await conn.execute(text("""
                        UPDATE stock_movements
                        SET created_at = :new_ts, modified_at = NOW()
                        WHERE reference_doc_id::text = :gid OR reference_doc_id::text = :rno;
                    """), {"new_ts": new_ts, "gid": str_grn_id, "rno": actual_rno})

                    sm_count = upd_sm.rowcount
                    total_movements_affected += sm_count

                    audit_log.append({
                        "grn_id": str_grn_id,
                        "receipt_no": actual_rno,
                        "old_created_at": old_ts.isoformat() if old_ts else None,
                        "new_created_at": new_ts.isoformat(),
                        "stock_movements_updated": sm_count,
                        "status": "REMEDIATED",
                    })

            return {
                "success": True,
                "mode": "LIVE_COMMITTED",
                "database": req.database,
                "remediated_count": len(audit_log),
                "total_movements_updated": total_movements_affected,
                "not_found": not_found,
                "errors": errors,
                "remediated_items": audit_log,
                "message": f"Successfully remediated {len(audit_log)} GRNs and {total_movements_affected} stock movements in {req.database}.",
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "remediated_count": len(audit_log),
            "not_found": not_found,
            "errors": errors + [str(e)],
        }
    finally:
        await engine.dispose()



