"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.46.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance — Declarative Database Column Classification Contract
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Tuple, Optional, Set, List


class ColumnClassification(str, Enum):
    """
    Closed 5-category contract for physical database column classification.
    Strictly NO sixth unofficial category permitted by CFOC policy.
    """
    CANONICAL_BUSINESS = "CANONICAL_BUSINESS"  # Authoritative business field mapped in CANONICAL_FIELDS
    AUDIT              = "AUDIT"               # Audit, tenancy, and temporal metadata
    TECHNICAL_FK       = "TECHNICAL_FK"        # Primary keys, foreign keys, UUIDs, relations
    FRAMEWORK          = "FRAMEWORK"           # Application framework, soft-delete, versioning flags
    MIGRATION          = "MIGRATION"           # Legacy import, sync tokens, transitional columns


@dataclass(frozen=True)
class DBColumnClassificationEntry:
    table: str
    column: str
    classification: ColumnClassification
    reason: str
    owner: str = "CHIEF_ARCHITECT"
    version: str = "3.46.0"


# ==============================================================================
# Canonical Column Classification Registry
# ==============================================================================

# Standard column categories across SMRITI PostgreSQL schema
STANDARD_AUDIT_COLUMNS: Set[str] = {
    "created_at", "modified_at", "updated_at", "created_by", "updated_by",
    "deleted_at", "deleted_by", "tenant_id", "company_id", "branch_id",
}

STANDARD_FRAMEWORK_COLUMNS: Set[str] = {
    "is_active", "is_deleted", "status", "version", "metadata", "is_system",
    "is_default", "flags", "state", "rule_snapshots", "priority", "required_role",
    "workflow_status", "mode", "tracking_type", "is_tax_inclusive",
}

STANDARD_TECHNICAL_FK_COLUMNS: Set[str] = {
    "id", "uuid", "role_id", "user_id", "customer_id", "supplier_id", "party_id",
    "item_id", "product_id", "account_id", "warehouse_id", "terminal_id",
    "counter_id", "order_id", "invoice_id", "department_id", "designation_id",
    "source_quotation_id", "source_document_id", "source_document_line_id",
    "customer_po_id", "delivery_location_id", "billing_location_id",
    "billed_party_gstin_id", "dispatch_from_location_id", "governance_snapshot_id",
    "parent_id", "template_id", "matrix_id", "series_id", "price_list_id",
    "item_variant_id", "size_scale_id", "parent_value_id",
}

STANDARD_MIGRATION_COLUMNS: Set[str] = {
    "identity_code", "legacy_code", "old_id", "sync_token", "import_batch_id",
    "imported_at", "import_validation_status", "import_validation_notes",
    "source_type", "source_system", "source_file", "sis_code", "pos_state",
    "customer_po_number_snapshot", "customer_po_date_snapshot",
    "delivery_location_snapshot", "dispatch_from_snapshot",
    "original_pdf_sha256", "original_pdf_path", "original_pdf_size", "original_pdf_pages",
    # Historical dropped or transitional columns across migrations
    "aadhaar", "alternate_mobile", "anniversary_date", "billing_address_line1",
    "billing_address_line2", "billing_city", "billing_country", "billing_pincode",
    "billing_state", "blacklisted", "credit_days_override", "credit_limit_override",
    "customer_type", "lead_source", "loyalty_member", "notes", "occupation",
    "opening_balance", "opening_balance_type", "pan", "photo_url", "preferred_language",
    "route", "salesperson", "shipping_address_line1", "shipping_address_line2",
    "shipping_city", "shipping_country", "shipping_pincode", "shipping_same_as_billing",
    "shipping_state", "territory", "allow_promotions_on_rate", "address",
    "allowed_branches", "city", "country", "date_of_birth", "date_of_joining",
    "display_name", "emergency_contact", "employee_code", "employee_id",
    "employment_type", "gender", "notification_settings_json", "payment_json",
    "performance_json", "photo", "pin_code", "preferences_json", "reporting_manager",
    "salary_json", "category_code", "cbm_m3", "document_number", "gallery_images",
    "primary_image_url", "reserved_stock", "sourcing_mode_override", "vendor_code",
    "hsn_sac_code", "metadata_json", "uom", "data", "sort_order", "company_code",
    "description", "financial_year", "last_reset_key", "module", "suffix",
    "billing_store_code", "delivery_gstin", "delivery_store_code",
    "place_of_supply_code", "source_document_type", "customer_name", "date",
    "po_number", "approved_at", "approved_by",
}


def _build_declarative_classification_registry() -> Dict[Tuple[str, str], DBColumnClassificationEntry]:
    """
    Builds the authoritative declarative classification registry for physical columns.
    """
    from app.governance.field_registry import CANONICAL_FIELDS

    registry: Dict[Tuple[str, str], DBColumnClassificationEntry] = {}

    # 1. Register all Canonical Business Fields
    for fid, fdef in CANONICAL_FIELDS.items():
        key = (fdef.db_table, fdef.db_column)
        registry[key] = DBColumnClassificationEntry(
            table=fdef.db_table,
            column=fdef.db_column,
            classification=ColumnClassification.CANONICAL_BUSINESS,
            reason=f"Authoritative canonical field '{fid}' ({fdef.label})",
            owner="CFOC_REGISTRY",
            version="3.46.0",
        )

    # 2. Governed tables requiring explicit classification
    governed_tables = {fdef.db_table for fdef in CANONICAL_FIELDS.values()}

    # Populate standard classifications for governed tables
    for table in governed_tables:
        # Audit
        for col in STANDARD_AUDIT_COLUMNS:
            key = (table, col)
            if key not in registry:
                registry[key] = DBColumnClassificationEntry(
                    table=table,
                    column=col,
                    classification=ColumnClassification.AUDIT,
                    reason=f"Standard tenancy/audit/temporal metadata attribute",
                    owner="ARCHITECTURE_GOVERNANCE",
                    version="3.46.0",
                )

        # Framework
        for col in STANDARD_FRAMEWORK_COLUMNS:
            key = (table, col)
            if key not in registry:
                registry[key] = DBColumnClassificationEntry(
                    table=table,
                    column=col,
                    classification=ColumnClassification.FRAMEWORK,
                    reason=f"Framework soft-delete, active-state, or optimistic lock version",
                    owner="ARCHITECTURE_GOVERNANCE",
                    version="3.46.0",
                )

        # Technical FK
        for col in STANDARD_TECHNICAL_FK_COLUMNS:
            key = (table, col)
            if key not in registry:
                registry[key] = DBColumnClassificationEntry(
                    table=table,
                    column=col,
                    classification=ColumnClassification.TECHNICAL_FK,
                    reason=f"Technical primary key, UUID, or relational foreign key reference",
                    owner="ARCHITECTURE_GOVERNANCE",
                    version="3.46.0",
                )

        # Migration
        for col in STANDARD_MIGRATION_COLUMNS:
            key = (table, col)
            if key not in registry:
                registry[key] = DBColumnClassificationEntry(
                    table=table,
                    column=col,
                    classification=ColumnClassification.MIGRATION,
                    reason=f"Legacy ETL migration, statutory audit hash, or immutable snapshot",
                    owner="ARCHITECTURE_GOVERNANCE",
                    version="3.46.0",
                )

    return registry


CFOC_DB_COLUMN_CLASSIFICATION: Dict[Tuple[str, str], DBColumnClassificationEntry] = _build_declarative_classification_registry()


def get_column_classification(table: str, column: str) -> Optional[DBColumnClassificationEntry]:
    """Retrieves the declarative classification for a given physical database column."""
    return CFOC_DB_COLUMN_CLASSIFICATION.get((table, column))


def classify_column(
    table: str,
    column: str,
    classification: ColumnClassification,
    reason: str,
    owner: str = "CHIEF_ARCHITECT",
    version: str = "3.46.0",
) -> DBColumnClassificationEntry:
    """Classifies a column explicitly, ensuring it conforms to the closed 5-category contract."""
    if not isinstance(classification, ColumnClassification):
        raise ValueError(f"Invalid classification '{classification}'. Must be one of {[c.value for c in ColumnClassification]}")
    entry = DBColumnClassificationEntry(
        table=table,
        column=column,
        classification=classification,
        reason=reason,
        owner=owner,
        version=version,
    )
    CFOC_DB_COLUMN_CLASSIFICATION[(table, column)] = entry
    return entry


def verify_column_classification_invariants() -> Dict[str, int]:
    """
    Validates that all classified entries adhere to the closed 5-category contract.
    """
    counts = {c.value: 0 for c in ColumnClassification}
    for (t, c), entry in CFOC_DB_COLUMN_CLASSIFICATION.items():
        assert entry.classification in ColumnClassification, f"Illegal column classification: {entry.classification}"
        assert entry.reason, f"Missing rationale for column classification on {t}.{c}"
        assert entry.owner, f"Missing owner for column classification on {t}.{c}"
        counts[entry.classification.value] += 1
    return counts
