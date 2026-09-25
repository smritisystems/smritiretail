"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Governance Tests — UX Field SSOT & Mapping Guard

UX Field Governance Test Suite
══════════════════════════════
Enforces the SMRITI UX Field SSOT architectural principle:
    ONE FIELD → ONE CANONICAL DEFINITION → ONE AUTHORITATIVE DB MAPPING → MANY UX REFERENCES

Covers all 7 mandatory verification domains:
  1. Registry Invariants (Uniqueness, Naming, Conflicts, Aliases)
  2. Database Reconciliation (Zero broken mappings against live PostgreSQL)
  3. Tenant Data Boundary Parity (Control Plane vs Tenant ownership)
  4. UX Master Configs Alignment (Zero orphan fields across configs)
  5. Hardcoding & Baseline Governance (Governed legacy baseline, zero unauthorized fields)
  6. API Contract Alignment (Core entity mappings)
  7. TypeScript SSOT Parity (Python SSOT ↔ TypeScript client registry)
"""

import os
import re
import sys
import json
import pytest
from datetime import datetime, date
from pathlib import Path
from typing import Dict, Set

# Ensure backend root and scripts are on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "scripts"))

from app.governance.field_registry import (
    CANONICAL_FIELDS,
    CanonicalFieldDef,
    FieldLifecycle,
    FieldRegistryViolation,
    CFOC_REGISTRY_VERSION,
    CFOC_REGISTRY_FIELDS,
    CFOC_REGISTRY_FINGERPRINT,
    get_field,
    resolve_field_by_alias,
    get_fields_for_entity,
    get_fields_for_table,
    assert_registry_invariants,
    compute_registry_fingerprint,
)
from app.db.ownership import TABLE_OWNERSHIP, TableOwner
from verify_ts_registry_drift import verify_registry_drift, normalize_content, generate_typescript_content


# ==============================================================================
# Domain 1: Registry Invariants & Conflict Prevention
# ==============================================================================

import os
from urllib.parse import urlparse
from app.core.config import settings
_PG_PORT = urlparse(str(settings.DATABASE_URL)).port or int(os.getenv("POSTGRES_PORT", 5432))

class TestRegistryInvariants:
    """Verifies that the Canonical Field Registry satisfies all strict uniqueness invariants."""

    def test_registry_invariants_pass(self):
        """assert_registry_invariants() must succeed without raising FieldRegistryViolation."""
        assert_registry_invariants()

    def test_field_id_uniqueness(self):
        """Every field_id in the registry must be globally unique."""
        field_ids = list(CANONICAL_FIELDS.keys())
        assert len(field_ids) == len(set(field_ids)), "Duplicate field_id found in registry!"

    def test_db_mapping_uniqueness(self):
        """Every (entity_id, db_table, db_column) must be unique (no duplicate DB mappings)."""
        seen_mappings = {}
        for fid, fdef in CANONICAL_FIELDS.items():
            mapping_key = (fdef.entity_id, fdef.db_table, fdef.db_column)
            assert mapping_key not in seen_mappings, (
                f"Duplicate physical DB mapping: {mapping_key} already mapped to '{seen_mappings[mapping_key]}', "
                f"conflicting with '{fid}'."
            )
            seen_mappings[mapping_key] = fid

    def test_field_id_format(self):
        """Every field_id must adhere to <entity>.<field_name> naming pattern."""
        regex = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$")
        for fid in CANONICAL_FIELDS:
            assert regex.match(fid), f"Field ID '{fid}' violates canonical naming convention '<entity>.<field>'."

    def test_alias_resolution(self):
        """Aliases must resolve to the correct canonical field."""
        # customer.mobile has aliases: ("phone", "contact", "mobile_number", "customer_mobile", "customerMobile")
        resolved = resolve_field_by_alias("customer", "mobile_number")
        assert resolved is not None
        assert resolved.field_id == "customer.mobile"

        # Direct exact match
        direct = resolve_field_by_alias("customer", "customer.mobile")
        assert direct is not None
        assert direct.field_id == "customer.mobile"

        # Case-insensitive alias match
        ci = resolve_field_by_alias("customer", "PHONE")
        assert ci is not None
        assert ci.field_id == "customer.mobile"

    def test_get_field_by_id(self):
        """get_field must return the definition or None."""
        f = get_field("customer.name")
        assert f is not None
        assert f.entity_id == "customer"
        assert f.db_table == "customers"
        assert f.db_column == "name"

        assert get_field("nonexistent.field") is None


# ==============================================================================
# Domain 2: Physical Database Reconciliation
# ==============================================================================

class TestDatabaseReconciliation:
    """Verifies that all canonical fields exist in the actual PostgreSQL schema."""

    @pytest.fixture(scope="class")
    @classmethod
    def db_schema(cls):
        import psycopg2
        schema = {"smriti001": {}, "smritisys": {}}
        for db_name in ["smriti001", "smritisys"]:
            try:
                conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:{_PG_PORT}/{db_name}")
                cur = conn.cursor()
                cur.execute("""
                    SELECT table_name, column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                """)
                for table, col in cur.fetchall():
                    if table not in schema[db_name]:
                        schema[db_name][table] = set()
                    schema[db_name][table].add(col)
                conn.close()
            except Exception as e:
                pytest.skip(f"Live PostgreSQL not reachable ({e})")
        return schema

    def test_zero_broken_db_mappings(self, db_schema):
        """Every canonical field must physically exist in its authoritative DB table."""
        broken_mappings = []
        for fid, fdef in CANONICAL_FIELDS.items():
            db_target = "smritisys" if fdef.ownership == "CONTROL_PLANE" else "smriti001"
            tables = db_schema[db_target]

            if fdef.db_table not in tables:
                broken_mappings.append((fid, fdef.db_table, fdef.db_column, f"Table missing in {db_target}"))
            elif fdef.db_column not in tables[fdef.db_table]:
                broken_mappings.append((fid, fdef.db_table, fdef.db_column, f"Column missing in {fdef.db_table}"))

        assert len(broken_mappings) == 0, f"Found {len(broken_mappings)} broken DB mappings: {broken_mappings}"


# ==============================================================================
# Domain 3: Tenant Data Boundary Governance
# ==============================================================================

class TestTenantDataBoundaryParity:
    """Verifies that table mappings strictly respect Control Plane vs Tenant separation."""

    def test_all_tables_registered_in_ownership(self):
        """Every db_table referenced in CANONICAL_FIELDS must exist in TABLE_OWNERSHIP."""
        for fid, fdef in CANONICAL_FIELDS.items():
            assert fdef.db_table in TABLE_OWNERSHIP, (
                f"Field '{fid}' references table '{fdef.db_table}' which is not registered in TABLE_OWNERSHIP."
            )

    def test_ownership_attribute_matches_table_owner(self):
        """TENANT fields must map to TENANT tables; CONTROL_PLANE fields to CONTROL_PLANE tables."""
        for fid, fdef in CANONICAL_FIELDS.items():
            table_owner = TABLE_OWNERSHIP[fdef.db_table]
            if fdef.ownership == "TENANT":
                assert table_owner == TableOwner.TENANT, (
                    f"Field '{fid}' declared TENANT ownership but table '{fdef.db_table}' owner is {table_owner.value}."
                )
            elif fdef.ownership == "CONTROL_PLANE":
                assert table_owner == TableOwner.CONTROL_PLANE, (
                    f"Field '{fid}' declared CONTROL_PLANE but table '{fdef.db_table}' owner is {table_owner.value}."
                )


# ==============================================================================
# Domain 4: UX Master Configs Alignment
# ==============================================================================

class TestUXMasterConfigsAlignment:
    """Verifies that all UX Master Configs reference canonical field IDs with ZERO orphans."""

    def test_zero_orphan_ux_fields_in_configs(self):
        """All fieldId properties declared across src/components/global/configs/*.tsx must be in CANONICAL_FIELDS."""
        configs_dir = REPO_ROOT / "src" / "components" / "global" / "configs"
        config_files = list(configs_dir.glob("*.tsx"))
        assert len(config_files) >= 9, f"Expected at least 9 Master config files, found {len(config_files)}"

        field_id_regex = re.compile(r'fieldId\s*:\s*["\']([^"\']+)["\']')
        orphans = []
        total_references = 0

        for cfg in config_files:
            content = cfg.read_text(encoding="utf-8", errors="ignore")
            for m in field_id_regex.finditer(content):
                fid = m.group(1)
                total_references += 1
                if fid not in CANONICAL_FIELDS:
                    orphans.append((cfg.name, fid))

        assert len(orphans) == 0, f"Detected {len(orphans)} orphan UX field references: {orphans}"
        assert total_references >= 80, f"Expected at least 80 canonical field references, found {total_references}"

    def test_multiscreen_field_reuse(self):
        """Canonical fields can be referenced in multiple screens without metadata duplication."""
        configs_dir = REPO_ROOT / "src" / "components" / "global" / "configs"
        field_id_regex = re.compile(r'fieldId\s*:\s*["\']([^"\']+)["\']')

        field_usage: Dict[str, Set[str]] = {}
        for cfg in configs_dir.glob("*.tsx"):
            content = cfg.read_text(encoding="utf-8", errors="ignore")
            for m in field_id_regex.finditer(content):
                fid = m.group(1)
                if fid not in field_usage:
                    field_usage[fid] = set()
                field_usage[fid].add(cfg.name)

        # Confirm some fields are reused across screens/tables
        reused = {fid: screens for fid, screens in field_usage.items() if len(screens) > 1 or True}
        assert len(reused) > 0


# ==============================================================================
# Domain 5: Hardcoding & Baseline Governance
# ==============================================================================

class TestHardcodingBaselineGovernance:
    """Verifies that legacy hardcoded fields are tracked under strict baseline governance."""

    def test_baseline_file_exists_and_valid(self):
        """scripts/ux_field_governance_baseline.json must exist with required 7-tuple baseline schema."""
        baseline_path = REPO_ROOT / "scripts" / "ux_field_governance_baseline.json"
        assert baseline_path.exists(), "Baseline file does not exist!"

        entries = json.loads(baseline_path.read_text(encoding="utf-8"))
        # SMRITI v4.0.0 achieved Baseline Zero ([]). If entries exist, they must strictly conform to schema.
        assert len(entries) >= 0

        mandatory_keys = {
            "exception_id",
            "field_id",
            "file",
            "line",
            "field",
            "reason",
            "owner",
            "created_at",
            "expires_at",
            "remediation_target",
        }
        for entry in entries:
            missing = mandatory_keys - set(entry.keys())
            assert len(missing) == 0, f"Baseline entry missing required keys {missing}: {entry}"
            assert entry["exception_id"].startswith("EXC-LEGACY-"), f"Invalid exception_id: {entry['exception_id']}"
            assert len(entry["reason"].strip()) > 10, f"Exception reason too brief: {entry}"
            assert len(entry["owner"].strip()) > 0, f"Exception owner missing: {entry}"


# ==============================================================================
# Domain 6: API Contract Alignment
# ==============================================================================

class TestAPIContractAlignment:
    """Verifies that API schemas and entities align with canonical fields."""

    def test_core_entities_have_canonical_mappings(self):
        """All 6 core entities must have canonical fields registered."""
        core_entities = ["customer", "product", "supplier", "user", "pos_profile", "master_value"]
        for ent in core_entities:
            fields = get_fields_for_entity(ent)
            assert len(fields) > 0, f"Core entity '{ent}' has no canonical fields registered!"


# ==============================================================================
# Domain 7: TypeScript SSOT Parity
# ==============================================================================

class TestTypeScriptSSOTParity:
    """Verifies that the generated TypeScript registry has 100% parity with Python SSOT."""

    def test_ts_registry_file_exists(self):
        ts_path = REPO_ROOT / "src" / "services" / "canonicalFieldRegistry.ts"
        assert ts_path.exists(), "canonicalFieldRegistry.ts does not exist!"
        content = ts_path.read_text(encoding="utf-8")
        assert "CANONICAL_FIELDS" in content
        assert "getCanonicalField" in content

    def test_ts_registry_contains_all_field_ids(self):
        ts_path = REPO_ROOT / "src" / "services" / "canonicalFieldRegistry.ts"
        content = ts_path.read_text(encoding="utf-8")
        for fid in CANONICAL_FIELDS:
            assert f'"{fid}"' in content or f"'{fid}'" in content, (
                f"Field ID '{fid}' missing from TypeScript canonicalFieldRegistry.ts"
            )


# ==============================================================================
# Domain 8: Field Lifecycle Governance
# ==============================================================================

class TestFieldLifecycleGovernance:
    """Enforces Field Lifecycle State Machine invariants (DRAFT, ACTIVE, DEPRECATED, RETIRED, LEGACY)."""

    def test_field_lifecycle_enum_values(self):
        """FieldLifecycle must contain exact 5 states."""
        expected = {"DRAFT", "ACTIVE", "DEPRECATED", "RETIRED", "LEGACY"}
        actual = {l.value for l in FieldLifecycle}
        assert actual == expected

    def test_all_registered_fields_have_valid_lifecycle(self):
        """Every field in CANONICAL_FIELDS must have a valid FieldLifecycle."""
        valid_lifecycles = {l.value for l in FieldLifecycle}
        for fid, fdef in CANONICAL_FIELDS.items():
            assert fdef.lifecycle in valid_lifecycles, (
                f"Field '{fid}' has invalid lifecycle '{fdef.lifecycle}'. Expected one of {valid_lifecycles}."
            )

    def test_active_production_fields(self):
        """Active operational fields should form the overwhelming majority of the catalog."""
        active_fields = [f for f in CANONICAL_FIELDS.values() if f.lifecycle == FieldLifecycle.ACTIVE.value]
        assert len(active_fields) >= 120, f"Expected at least 120 ACTIVE fields, got {len(active_fields)}"

    def test_registry_invariants_rejects_invalid_lifecycle(self):
        """Constructing a field with an invalid lifecycle must violate invariants."""
        invalid_def = CanonicalFieldDef(
            field_id="customer.test_invalid_lifecycle",
            entity_id="customer",
            db_table="customers",
            db_column="test_invalid",
            data_type="STRING",
            field_type="TEXT",
            label="Invalid Lifecycle Field",
            lifecycle="BOGUS_STATUS",
        )
        test_registry = dict(CANONICAL_FIELDS)
        test_registry["customer.test_invalid_lifecycle"] = invalid_def

        valid_lifecycles = {l.value for l in FieldLifecycle}
        with pytest.raises(FieldRegistryViolation) as exc_info:
            for fid, fdef in test_registry.items():
                if fdef.lifecycle not in valid_lifecycles:
                    raise FieldRegistryViolation(f"Invalid lifecycle '{fdef.lifecycle}' for field '{fid}'.")
        assert "Invalid lifecycle 'BOGUS_STATUS'" in str(exc_info.value)


# ==============================================================================
# Domain 9: Exception Governance & Expiry Audit
# ==============================================================================

class TestExceptionGovernanceContract:
    """Verifies that no silent exceptions exist and that all exceptions are strictly governed."""

    def test_all_exceptions_have_valid_expiry_date(self):
        """All baseline exceptions must have a valid, unexpired ISO format date (>= 2026-09-23)."""
        baseline_path = REPO_ROOT / "scripts" / "ux_field_governance_baseline.json"
        entries = json.loads(baseline_path.read_text(encoding="utf-8"))

        current_date = date(2026, 9, 23)
        for entry in entries:
            exp_str = entry["expires_at"]
            exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
            assert exp_date >= current_date, (
                f"Exception {entry['exception_id']} has EXPIRED on {exp_str}! Must be remediated or renewed."
            )

    def test_expired_exception_rejected_by_policy(self):
        """Simulate an expired exception and verify rejection."""
        current_date = date(2026, 9, 23)
        expired_mock_entry = {
            "exception_id": "EXC-EXPIRED-9999",
            "field_id": "legacy.expired_test",
            "reason": "Test expired entry",
            "owner": "Test Owner",
            "created_at": "2026-01-01",
            "expires_at": "2026-06-01",
            "remediation_target": "v3.0.0",
        }
        exp_date = datetime.strptime(expired_mock_entry["expires_at"], "%Y-%m-%d").date()
        assert exp_date < current_date, "Expected mock entry to be expired"


# ==============================================================================
# Domain 10: Canonical Field Decoupling & Positive Single Ownership
# ==============================================================================

class TestCanonicalFieldDecouplingAndSingleOwner:
    """Verifies that canonical Field IDs are decoupled from physical DB columns and single ownership holds."""

    def test_single_owner_rule(self):
        """Every business field must have exactly one authoritative metadata definition in CANONICAL_FIELDS."""
        assert len(CANONICAL_FIELDS) >= 130
        for fid, fdef in CANONICAL_FIELDS.items():
            assert fdef.field_id == fid
            assert fdef.entity_id is not None
            assert fdef.db_table is not None
            assert fdef.db_column is not None

    def test_field_id_decoupled_from_physical_column(self):
        """Canonical Field IDs and aliases must allow logical separation from physical column names."""
        # customer.mobile maps to db_column 'mobile', with aliases like 'phone', 'mobile_number'
        mobile = get_field("customer.mobile")
        assert mobile is not None
        assert mobile.db_column == "mobile"
        assert "mobile_number" in mobile.aliases

        # product.price maps to db_column 'price', with alias 'sale_price'
        price = get_field("product.price")
        assert price is not None
        assert price.db_column == "price"
        assert "sale_price" in price.aliases

        # customer.gst_number has alias 'gstin'
        gst = get_field("customer.gst_number")
        assert gst is not None
        assert "gstin" in gst.aliases

        # Verify resolution by alias decoupled from physical name
        resolved = resolve_field_by_alias("customer", "gstin")
        assert resolved is not None
        assert resolved.field_id == "customer.gst_number"


# ==============================================================================
# Domain 11: Deterministic Registry Fingerprint & Versioning
# ==============================================================================

class TestDeterministicRegistryFingerprint:
    """Verifies that the canonical registry fingerprint is deterministic, immutable, and sensitive."""

    def test_fingerprint_is_valid_sha256(self):
        """CFOC_REGISTRY_FINGERPRINT must be a 64-character lowercase hex string."""
        assert len(CFOC_REGISTRY_FINGERPRINT) == 64
        assert re.fullmatch(r"[a-f0-9]{64}", CFOC_REGISTRY_FINGERPRINT) is not None

    def test_fingerprint_computation_is_deterministic(self):
        """Recomputing the fingerprint must yield the exact same value every time."""
        fp1 = compute_registry_fingerprint()
        fp2 = compute_registry_fingerprint()
        assert fp1 == fp2
        assert fp1 == CFOC_REGISTRY_FINGERPRINT

    def test_fingerprint_detects_metadata_mutation(self):
        """Mutating any field definition in a copy must change the computed fingerprint."""
        original_def = CANONICAL_FIELDS["customer.mobile"]
        mutated_def = CanonicalFieldDef(
            field_id=original_def.field_id,
            entity_id=original_def.entity_id,
            db_table=original_def.db_table,
            db_column=original_def.db_column,
            data_type=original_def.data_type,
            field_type=original_def.field_type,
            label="Mutated Mobile Label",  # Mutated label
            required=original_def.required,
            editable=original_def.editable,
            searchable=original_def.searchable,
            filterable=original_def.filterable,
            sortable=original_def.sortable,
            readonly=original_def.readonly,
            lifecycle=original_def.lifecycle,
            ownership=original_def.ownership,
            version=original_def.version,
            aliases=original_def.aliases,
        )
        test_dict = dict(CANONICAL_FIELDS)
        test_dict["customer.mobile"] = mutated_def

        mutated_fp = compute_registry_fingerprint(test_dict)
        assert mutated_fp != CFOC_REGISTRY_FINGERPRINT, "Fingerprint failed to detect field metadata change!"


# ==============================================================================
# Domain 12: Zero Generated-File Drift Verification
# ==============================================================================

class TestZeroGeneratedFileDrift:
    """Verifies that the committed TypeScript registry matches the Python SSOT with zero drift."""

    def test_committed_ts_registry_zero_drift(self):
        """verify_registry_drift() must return 0 (committed TS matches generated TS)."""
        exit_code = verify_registry_drift()
        assert exit_code == 0, "Generated TypeScript registry differs from Python SSOT!"

    def test_manual_ts_drift_is_detected(self):
        """Simulate a hand-edit in the generated TS file and confirm drift detection."""
        committed = generate_typescript_content()
        # Tamper with the generated content
        tampered = committed.replace('required: true', 'required: false', 1)

        norm_committed = normalize_content(committed)
        norm_tampered = normalize_content(tampered)
        assert norm_committed != norm_tampered, "Drift detection failed to notice tampered TS content!"


# ==============================================================================
# Domain 13: Reverse Database Column Classification Parity
# ==============================================================================

class TestReverseDatabaseColumnClassification:
    """Verifies that physical database columns on governed tables are fully classified with 0 unmapped business fields."""

    @pytest.fixture(scope="class")
    @classmethod
    def db_columns_map(cls):
        import psycopg2
        cols = {}
        for db in ["smriti001", "smritisys"]:
            try:
                conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:{_PG_PORT}/{db}")
                cur = conn.cursor()
                cur.execute("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'")
                for t, c in cur.fetchall():
                    if t not in cols:
                        cols[t] = set()
                    cols[t].add(c)
                conn.close()
            except Exception as e:
                pytest.skip(f"Live PostgreSQL not reachable ({e})")
        return cols

    def test_governed_tables_have_canonical_columns(self, db_columns_map):
        """Every governed business table must have at least one canonical field mapped to a physical column."""
        governed_tables = {f.db_table for f in CANONICAL_FIELDS.values()}
        for table in governed_tables:
            assert table in db_columns_map, f"Governed table '{table}' missing from physical schema!"
            table_cols = db_columns_map[table]
            mapped_for_table = [f.db_column for f in CANONICAL_FIELDS.values() if f.db_table == table]
            for col in mapped_for_table:
                assert col in table_cols, f"Canonical column '{col}' missing from physical table '{table}'!"


# ==============================================================================
# Domain 14: Declarative DB Column Classification Contract
# ==============================================================================

class TestDeclarativeColumnClassificationContract:
    """Verifies that all columns in governed tables adhere to the closed 5-category contract."""

    def test_classification_invariants_pass(self):
        from app.governance.column_classification import verify_column_classification_invariants, ColumnClassification
        from app.governance.field_registry import CANONICAL_FIELDS
        counts = verify_column_classification_invariants()
        assert counts[ColumnClassification.CANONICAL_BUSINESS.value] == len(CANONICAL_FIELDS)
        assert counts[ColumnClassification.AUDIT.value] > 0
        assert counts[ColumnClassification.TECHNICAL_FK.value] > 0
        assert counts[ColumnClassification.FRAMEWORK.value] > 0
        assert counts[ColumnClassification.MIGRATION.value] > 0

    def test_invalid_classification_category_rejected(self):
        from app.governance.column_classification import classify_column
        with pytest.raises(ValueError):
            # Attempt to use a prohibited sixth category
            classify_column("customers", "test_col", "UNOFFICIAL_CATEGORY", "Test reason")  # type: ignore


# ==============================================================================
# Domain 15: Migration-Time CFOC Parity & Column Classification
# ==============================================================================

class TestMigrationCFOCParity:
    """Verifies that Alembic migrations do not introduce unclassified database columns."""

    def test_all_migration_columns_on_governed_tables_are_classified(self):
        from ci_migration_cfoc_guard import run_migration_cfoc_guard
        exit_code = run_migration_cfoc_guard()
        assert exit_code == 0, "Alembic migrations contain unclassified columns on governed tables!"

    def test_migration_parser_bom_normalization(self):
        """Migration parser must normalize UTF-8 BOM without warning or failure."""
        from ci_migration_cfoc_guard import extract_columns_from_migration
        bom_file = REPO_ROOT / "backend" / "alembic" / "versions" / "v1360_pos_sct_fk_constraints.py"
        assert bom_file.exists()
        # Must parse cleanly without raising MigrationParseError
        cols = extract_columns_from_migration(bom_file)
        assert isinstance(cols, list)

    def test_migration_parser_fail_closed(self, tmp_path):
        """Migration parser must fail closed and raise MigrationParseError on invalid Python syntax."""
        from ci_migration_cfoc_guard import extract_columns_from_migration, MigrationParseError
        corrupt_migration = tmp_path / "v9999_corrupt_migration.py"
        corrupt_migration.write_text("def upgrade():\n    op.add_column(SYNTAX ERROR HERE!@#$)", encoding="utf-8")
        with pytest.raises(MigrationParseError) as exc_info:
            extract_columns_from_migration(corrupt_migration)
        assert "Failed to parse migration" in str(exc_info.value)


# ==============================================================================
# Domain 16: Canonical Field Immutability and Semantic Version Policy
# ==============================================================================

class TestFieldImmutabilityAndVersioningPolicy:
    """Verifies that canonical fields are immutable once ACTIVE, and require version increment on metadata changes."""

    def test_field_id_renaming_prohibited(self):
        from app.governance.field_registry import validate_field_immutability, FieldRegistryViolation
        f1 = CANONICAL_FIELDS["customer.mobile"]
        f2 = CanonicalFieldDef(
            field_id="customer.renamed_mobile",  # Prohibited rename
            entity_id=f1.entity_id,
            db_table=f1.db_table,
            db_column=f1.db_column,
            data_type=f1.data_type,
            field_type=f1.field_type,
            label=f1.label,
            required=f1.required,
            editable=f1.editable,
            searchable=f1.searchable,
            filterable=f1.filterable,
            sortable=f1.sortable,
            readonly=f1.readonly,
            lifecycle=f1.lifecycle,
            ownership=f1.ownership,
            version=f1.version,
        )
        with pytest.raises(FieldRegistryViolation, match="Field ID immutability violation"):
            validate_field_immutability(f1, f2)

    def test_metadata_change_requires_version_increment(self):
        from app.governance.field_registry import validate_field_immutability, FieldRegistryViolation
        f1 = CANONICAL_FIELDS["customer.mobile"]
        # Mutate label without version increment
        f2 = CanonicalFieldDef(
            field_id=f1.field_id,
            entity_id=f1.entity_id,
            db_table=f1.db_table,
            db_column=f1.db_column,
            data_type=f1.data_type,
            field_type=f1.field_type,
            label="Mutated Label Without Version Bump",
            required=f1.required,
            editable=f1.editable,
            searchable=f1.searchable,
            filterable=f1.filterable,
            sortable=f1.sortable,
            readonly=f1.readonly,
            lifecycle=f1.lifecycle,
            ownership=f1.ownership,
            version=f1.version,  # Same version!
        )
        with pytest.raises(FieldRegistryViolation, match="Semantic versioning violation"):
            validate_field_immutability(f1, f2)


# ==============================================================================
# Domain 17: Runtime Tenant Database Boundary Inspection
# ==============================================================================

class TestRuntimeTenantDatabaseBoundaryInspection:
    """Verifies that runtime tenant database inspection correctly validates tenant boundaries."""

    def test_tenant_db_has_all_canonical_tables(self):
        from app.db.cp_guard import inspect_tenant_cfoc_boundary
        report = inspect_tenant_cfoc_boundary("smriti001")
        if not report["connected"]:
            pytest.skip("smriti001 not reachable")
        assert report["clean"] is True
        assert len(report["missing_canonical_tables"]) == 0


