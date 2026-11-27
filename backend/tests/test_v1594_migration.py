import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest

MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "v1594_restore_legacy_schema_repairs.py"
)
spec = importlib.util.spec_from_file_location("v1594_migration", MIGRATION_PATH)
assert spec is not None and spec.loader is not None
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class QueryResult:
    def __init__(self, *, first=None, scalar=None):
        self.first_value = first
        self.scalar_value = scalar

    def first(self):
        return self.first_value

    def scalar_one(self):
        return self.scalar_value


def test_unique_repair_rejects_duplicate_values(monkeypatch):
    inspector = Mock()
    inspector.get_unique_constraints.return_value = []
    inspector.get_indexes.return_value = []
    bind = Mock()
    bind.execute.return_value = QueryResult(first=("duplicate",))
    create_constraint = Mock()
    monkeypatch.setattr(migration, "_inspector", lambda: inspector)
    monkeypatch.setattr(migration, "_bind", lambda: bind)
    monkeypatch.setattr(migration.op, "create_unique_constraint", create_constraint)

    with pytest.raises(RuntimeError, match="duplicate uuid values"):
        migration._ensure_unique_constraint("customers", "uuid", "customers_uuid_key")

    create_constraint.assert_not_called()


def test_foreign_key_repair_rejects_orphaned_values(monkeypatch):
    inspector = Mock()
    inspector.get_foreign_keys.return_value = []
    bind = Mock()
    bind.execute.return_value = QueryResult(scalar=2)
    create_foreign_key = Mock()
    monkeypatch.setattr(migration, "_inspector", lambda: inspector)
    monkeypatch.setattr(migration, "_bind", lambda: bind)
    monkeypatch.setattr(migration.op, "create_foreign_key", create_foreign_key)

    with pytest.raises(RuntimeError, match="2 orphaned"):
        migration._ensure_foreign_key(
            "customers",
            "company_id",
            "companies",
            "fk_customers_company_id",
        )

    create_foreign_key.assert_not_called()


def test_downgrade_refuses_to_drop_forward_repairs():
    with pytest.raises(RuntimeError, match="forward-only schema repair"):
        migration.downgrade()
