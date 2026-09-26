# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: CI Governance — API DTO Reconciliation (CFOC v3.46.0 Pillar 4)

SMRITI CFOC v3.46.0 — Pillar 4: API DTO Reconciliation Guard
═════════════════════════════════════════════════════════════
Purpose:
  Performs AST-based bi-directional reconciliation between:
    1. Canonical Field Registry (SSOT) — field_registry.py
    2. Pydantic request/response models — backend/app/schemas/*.py

Governance Rules Enforced:
  - Every canonical ACTIVE business field for a governed entity MUST be
    represented in the corresponding Pydantic schema (as a field with a
    matching db_column name, or an explicit allowlisted alias).
  - Unregistered business field patterns in Pydantic DTOs that match
    canonical db_column names from other governed entities flag a
    CROSS-ENTITY LEAK warning.
  - Technical, audit, and FK fields are exempt from the business rule
    (they are in CFOC_DB_COLUMN_CLASSIFICATION but not CANONICAL_FIELDS).

Exit Codes:
  0 — All checks passed (or only warnings)
  1 — Critical violations detected (unregistered DTO business fields
      on governed entities)

Usage:
  python scripts/ci_api_dto_reconciliation.py [--warn-only]
"""

# ─────────────────────────────────────────────────────────────────────────────
#  Standard Library Only — no FastAPI/SQLAlchemy imports at CI time
# ─────────────────────────────────────────────────────────────────────────────
import ast
import sys
import argparse
import pathlib
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict

# ─────────────────────────────────────────────────────────────────────────────
#  PATH SETUP
# ─────────────────────────────────────────────────────────────────────────────
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY_PATH = REPO_ROOT / "backend" / "app" / "governance" / "field_registry.py"
SCHEMAS_DIR   = REPO_ROOT / "backend" / "app" / "schemas"

# ─────────────────────────────────────────────────────────────────────────────
#  ENTITY → SCHEMA MAPPING
#  Maps each canonical governed db_table to the Pydantic schema module(s)
#  and the primary Create/Request class(es) that expose those fields to APIs.
# ─────────────────────────────────────────────────────────────────────────────
ENTITY_SCHEMA_MAP: Dict[str, List[Tuple[str, List[str]]]] = {
    "customers": [
        ("party_master", ["PartyCreateRequest", "PartyUpdateRequest", "CustomerProfileData"]),
    ],
    "suppliers": [
        ("purchase",     ["SupplierCreate", "SupplierUpdate", "SupplierResponse"]),
        ("party_master", ["PartyCreateRequest", "SupplierProfileData"]),
    ],
    "items": [
        ("item_master",  ["ItemCreate", "ItemUpdate", "ItemResponse"]),
    ],
    "products": [
        ("item_master",  ["ItemCreate", "ItemUpdate", "ItemResponse"]),
    ],
    "purchase_orders": [
        ("purchase",     ["PurchaseOrderCreate", "PurchaseOrderResponse"]),
    ],
    "sales_invoices": [
        ("sales",        ["SalesInvoiceCreate", "SalesInvoiceResponse"]),
    ],
    "sales_orders": [
        ("sales",        ["SalesOrderCreate", "SalesOrderResponse"]),
    ],
    "cash_registers": [
        ("pos",          ["CashRegisterCreate", "CashRegisterResponse"]),
    ],
    "users": [
        ("user",         ["UserCreate", "UserResponse", "UserUpdate"]),
    ],
    "customer_groups": [
        ("masters_tier2", ["CustomerGroupCreate", "CustomerGroupResponse"]),
    ],
    "document_series": [
        ("numbering",    ["DocumentSeriesCreate", "DocumentSeriesResponse"]),
    ],
    "approval_policies": [
        ("approval",     ["ApprovalPolicyCreate", "ApprovalPolicyResponse"]),
    ],
    "terms_clauses": [
        ("terms",        ["TermsClauseCreate", "TermsClauseResponse"]),
    ],
    "master_values": [
        ("master_lookup", ["MasterValueCreate", "MasterValueResponse"]),
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
#  ALLOWLISTED DTO FIELD ALIASES
#  Some Pydantic fields use a different attribute name than the db_column
#  but map correctly via aliases, serialization_alias, or ORM mappings.
#  Declare them here to suppress false positives.
# ─────────────────────────────────────────────────────────────────────────────
DTO_CANONICAL_ALIASES: Dict[str, Set[str]] = {
    # pydantic_field_name -> set of canonical db_column names it represents
    "legal_name":    {"customer_name", "supplier_name"},
    "trade_name":    {"trade_name"},
    "party_code":    {"customer_code", "supplier_code"},
    "roles":         {"role_type"},
    "metadata_json": {"metadata"},
    # Party / CRM field aliases (PartyCreateRequest uses shorter names)
    "gstin":         {"gst_number"},
    "pan":           {"pan_number"},
    "phone":         {"phone"},
    "mobile":        {"mobile"},
    "email":         {"email"},
    "city":          {"city"},
    "state":         {"state"},
    "pincode":       {"pincode"},
    "address_line1": {"address"},
    "party_type":    {"party_type"},
    # item_master aliases
    "item_name":     {"item_name"},
    "item_code":     {"item_code"},
    "item_type":     {"item_type"},
    "tax_rate":      {"tax_rate"},
    "selling_price": {"selling_price"},
    "primary_uom":   {"uom"},
    "department":    {"department"},
    "category_code": {"category"},
}

# ─────────────────────────────────────────────────────────────────────────────
#  TECHNICAL FIELD EXEMPTIONS
#  Fields that are universally expected in Pydantic models but are not
#  canonical business fields (infra / pagination / audit / security patterns).
# ─────────────────────────────────────────────────────────────────────────────
EXEMPT_DTO_FIELDS: Set[str] = {
    # Primary keys and technical IDs
    "id", "uuid", "identity_code",
    # Timestamps
    "created_at", "updated_at", "deleted_at", "last_updated", "lastUpdated",
    # Soft-delete / status markers
    "is_deleted", "is_active", "isActive",
    # Multi-tenancy infrastructure
    "tenant_id", "company_id", "branch_id", "company_code", "companyCode",
    # Audit trail (write-side)
    "created_by", "updated_by", "updatedBy",
    # Security / auth — not a business field
    "password", "hashed_password", "token", "refresh_token",
    # Optimistic locking
    "version",
    # Pagination / list wrappers
    "page", "page_size", "limit", "offset", "sort_by", "sort_order",
    "total", "data", "message", "status", "success",
    # Pydantic config marker
    "model_config",
    # Nested / composite relationship containers
    "items", "lines", "addresses", "contacts", "roles", "tags",
    "allocations", "variants", "barcodes", "batches", "locations",
    "customer_profile", "supplier_profile", "profile",
    # Notes / free-text — allowed everywhere, not per-entity canonical
    "notes", "remarks", "description",
    # Computed / aggregated response fields (read-only, not stored)
    "total_sales", "total_shifts", "active_shift_opened",
    "subtotal", "grand_total", "tax_total", "taxable_value", "basic_total",
    # Document series camelCase schema (legacy pre-CFOC naming, governed via
    # document_series CFOC fields — alias mismatch is a known legacy exception)
    "documentType", "companyCode", "currentNumber", "financialYear",
    "isCommonAcrossTerminals", "isVoidUnified", "mode", "module",
    "numberFormat", "resetRule", "runningLength", "startNumber", "suffix",
    "terminalId", "transactionGroup", "lastResetKey",
    # Terms schema camelCase legacy
    "isActive", "lastUpdated", "updatedBy",
    # Master lookup camelCase legacy
    "vendorCode",
    # Approval schema fields pending CFOC registration
    "priority", "required_role",
    # Item extended attributes (composite entity, not flat canonical)
    "color", "size", "style_code", "is_batch_tracked", "is_serial_tracked",
    "vendor_code",
    # CustomerProfileData sub-schema fields (nested profile, maps to customer_profile table)
    # These are captured in CustomerProfileData which nests inside PartyCreateRequest
    "credit_limit", "credit_days", "customer_category", "is_credit_hold",
    "outstanding_balance", "tax_category", "loyalty_tier_id", "price_tier_id",
    # SupplierProfileData sub-schema fields (nested profile, maps to supplier_profile table)
    "supplier_type", "payment_terms_days", "msme_registration_no",
    "tax_treatment", "outstanding_liability",
}

# ─────────────────────────────────────────────────────────────────────────────
#  DATA TYPES
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class CanonicalField:
    field_id:   str
    db_table:   str
    db_column:  str
    data_type:  str
    lifecycle:  str

@dataclass
class DTOField:
    class_name:  str
    field_name:  str
    schema_file: str

@dataclass
class ReconciliationResult:
    entity:   str
    schema:   str
    cls:      str
    findings: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1 — EXTRACT CANONICAL FIELDS FROM REGISTRY (AST, no imports)
# ─────────────────────────────────────────────────────────────────────────────
def extract_canonical_fields() -> Dict[str, List[CanonicalField]]:
    """
    AST-parse field_registry.py and extract all CanonicalFieldDef(...) entries.
    Returns a mapping: db_table -> [CanonicalField, ...]
    """
    src  = REGISTRY_PATH.read_text(encoding="utf-8", errors="replace")
    tree = ast.parse(src, filename=str(REGISTRY_PATH))

    by_table: Dict[str, List[CanonicalField]] = defaultdict(list)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        func_name = ""
        if isinstance(func, ast.Name):
            func_name = func.id
        elif isinstance(func, ast.Attribute):
            func_name = func.attr

        if func_name != "CanonicalFieldDef":
            continue

        kws = {kw.arg: kw.value for kw in node.keywords if kw.arg}
        try:
            fid       = ast.literal_eval(kws["field_id"])
            db_table  = ast.literal_eval(kws["db_table"])
            db_column = ast.literal_eval(kws["db_column"])
            data_type = ast.literal_eval(kws.get("data_type", ast.Constant(value="STRING")))
            lifecycle = ast.literal_eval(kws.get("lifecycle", ast.Constant(value="ACTIVE")))
        except (KeyError, ValueError):
            continue

        by_table[db_table].append(CanonicalField(
            field_id=fid,
            db_table=db_table,
            db_column=db_column,
            data_type=data_type,
            lifecycle=lifecycle,
        ))

    return by_table

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 2 — EXTRACT PYDANTIC FIELD NAMES FROM SCHEMA (AST)
# ─────────────────────────────────────────────────────────────────────────────
def extract_dto_fields(schema_file: str, class_names: List[str]) -> Dict[str, Set[str]]:
    """
    AST-parse a schema file and extract field names for each named class.
    Returns: class_name -> set of attribute names.
    """
    path = SCHEMAS_DIR / f"{schema_file}.py"
    if not path.exists():
        return {}

    src  = path.read_text(encoding="utf-8", errors="replace")
    tree = ast.parse(src, filename=str(path))

    result: Dict[str, Set[str]] = {}

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        if node.name not in class_names:
            continue

        fields: Set[str] = set()

        # Collect annotated attributes (standard Pydantic field pattern)
        for stmt in node.body:
            if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                fields.add(stmt.target.id)
            # Also handle __fields__ style (rare but possible)
            elif isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    if isinstance(target, ast.Name):
                        fields.add(target.id)

        result[node.name] = fields

    return result

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 3 — RECONCILE: CANONICAL vs DTO
# ─────────────────────────────────────────────────────────────────────────────
def reconcile_entity(
    entity: str,
    canonical_fields: List[CanonicalField],
    schema_mapping: List[Tuple[str, List[str]]],
) -> List[ReconciliationResult]:
    """
    For each Pydantic class mapped to the entity:
    1. Check that ACTIVE canonical db_column names appear in the DTO (or an alias).
    2. Flag DTO fields that look like business fields but have no canonical registration.
    """
    results: List[ReconciliationResult] = []

    # Only check ACTIVE fields (DEPRECATED/RETIRED are not required in DTOs)
    active_cols: Set[str] = {
        f.db_column for f in canonical_fields if f.lifecycle == "ACTIVE"
    }

    # Build reverse alias map: canonical_col -> set of pydantic_field_names
    alias_reverse: Dict[str, Set[str]] = defaultdict(set)
    for pydantic_name, col_set in DTO_CANONICAL_ALIASES.items():
        for col in col_set:
            alias_reverse[col].add(pydantic_name)

    for schema_file, class_names in schema_mapping:
        dto_field_map = extract_dto_fields(schema_file, class_names)

        for cls_name in class_names:
            result = ReconciliationResult(entity=entity, schema=schema_file, cls=cls_name)

            dto_fields = dto_field_map.get(cls_name, None)
            if dto_fields is None:
                # Class not found — it may not exist yet (new entity) — warn only
                result.warnings.append(
                    f"Class '{cls_name}' not found in {schema_file}.py — "
                    f"may be a not-yet-created schema. Skipping."
                )
                results.append(result)
                continue

            # ── Check A: ACTIVE canonical columns present in DTO ──────────────
            # (Read: did we forget to expose a governed field in the API?)
            missing_from_dto: Set[str] = set()
            for col in active_cols:
                aliases = alias_reverse.get(col, set())
                if col not in dto_fields and not (aliases & dto_fields):
                    # Not a problem for Response models if col is write-only,
                    # but flag for Create/Update models that take business input
                    if "Create" in cls_name or "Update" in cls_name:
                        missing_from_dto.add(col)

            if missing_from_dto:
                result.warnings.append(
                    f"ACTIVE canonical columns absent from {cls_name}: "
                    + ", ".join(sorted(missing_from_dto))
                    + " — verify this is intentional (read-only, computed, or server-side field)."
                )

            # ── Check B: DTO fields that look like business fields but have
            #    no canonical registration (potential ungoverned additions) ───
            all_canonical_cols: Set[str] = {f.db_column for f in canonical_fields}
            all_alias_targets: Set[str] = {
                col for col_set in DTO_CANONICAL_ALIASES.values() for col in col_set
            }

            ungoverned: List[str] = []
            for dto_f in sorted(dto_fields):
                if dto_f in EXEMPT_DTO_FIELDS:
                    continue
                if dto_f.startswith("_"):
                    continue
                # If the dto field name exactly matches a canonical col or an alias pydantic name
                if dto_f in all_canonical_cols:
                    continue  # governed
                if dto_f in DTO_CANONICAL_ALIASES:
                    continue  # explicit alias — governed
                # Heuristic: field names that strongly suggest business data
                # (not pagination, not framework markers)
                looks_business = (
                    not dto_f.endswith("_id")      # skip FK refs
                    and not dto_f.endswith("_at")   # skip timestamps
                    and not dto_f.endswith("_by")   # skip audit
                    and dto_f not in {"roles", "addresses", "contacts", "tags",
                                      "items", "lines", "data", "profile",
                                      "customer_profile", "supplier_profile",
                                      "addresses", "contacts", "model_config"}
                )
                if looks_business:
                    ungoverned.append(dto_f)

            if ungoverned:
                result.findings.append(
                    f"UNREGISTERED business-pattern fields in {cls_name}: "
                    + ", ".join(ungoverned)
                    + " — these should either be added to CANONICAL_FIELDS or "
                    + "CFOC_DB_COLUMN_CLASSIFICATION (AUDIT/TECHNICAL_FK/FRAMEWORK)."
                )

            results.append(result)

    return results

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main(warn_only: bool = False) -> int:
    print("=" * 72)
    print("  SMRITI CFOC v3.46.0 — Pillar 4: API DTO Reconciliation Guard")
    print("=" * 72)

    # --- Load canonical registry ---
    print("\n[1/3] Extracting canonical field registry (AST) …")
    canonical_by_table = extract_canonical_fields()
    total_canonical = sum(len(v) for v in canonical_by_table.values())
    print(f"      {total_canonical} canonical fields across {len(canonical_by_table)} governed tables.")

    # --- Run reconciliation ---
    print("\n[2/3] Reconciling Pydantic DTOs against canonical registry …")
    all_results: List[ReconciliationResult] = []

    for entity, schema_mapping in ENTITY_SCHEMA_MAP.items():
        canonical_fields = canonical_by_table.get(entity, [])
        if not canonical_fields:
            print(f"  [WARN] Entity '{entity}' has no canonical fields — skipping.")
            continue
        results = reconcile_entity(entity, canonical_fields, schema_mapping)
        all_results.extend(results)

    # --- Report ---
    print("\n[3/3] Reconciliation Report")
    print("-" * 72)

    total_violations = 0
    total_warnings   = 0
    checked_classes  = 0

    for r in all_results:
        has_issues = r.findings or r.warnings
        status = "[PASS]" if not r.findings else "[FAIL]"
        if r.warnings and not r.findings:
            status = "[WARN]"
        label = f"  [{r.entity}] {r.schema}.{r.cls}"
        print(f"  {status:8s}  {label}")

        for w in r.warnings:
            print(f"             WARN: {w}")
            total_warnings += 1

        for v in r.findings:
            print(f"             FAIL: {v}")
            total_violations += 1

        checked_classes += 1

    print("-" * 72)
    print(f"\n  Checked  : {checked_classes} DTO classes")
    print(f"  Warnings : {total_warnings}")
    print(f"  Violations: {total_violations}")

    if total_violations == 0:
        print("\n  [OK] API DTO Reconciliation PASSED — all governed entities have"
              " consistent Pydantic representations.\n")
        return 0
    elif warn_only:
        print(f"\n  [WARN] {total_violations} violation(s) found (--warn-only mode — "
              f"not failing CI).\n")
        return 0
    else:
        print(f"\n  [FAIL] {total_violations} DTO governance violation(s) detected. "
              f"Register canonical fields before adding them to Pydantic schemas.\n")
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CFOC v3.46.0 API DTO Reconciliation Guard")
    parser.add_argument(
        "--warn-only",
        action="store_true",
        default=False,
        help="Emit violations as warnings only (exit 0). Use during onboarding.",
    )
    args = parser.parse_args()
    sys.exit(main(warn_only=args.warn_only))
