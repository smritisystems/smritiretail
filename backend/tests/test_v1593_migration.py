import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest

MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "v1593_repair_partial_schema_drift.py"
)
spec = importlib.util.spec_from_file_location("v1593_migration", MIGRATION_PATH)
assert spec is not None and spec.loader is not None
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class QueryResult:
    def __init__(self, rows=(), scalar=None, first=None):
        self.rows = rows
        self.scalar_value = scalar
        self.first_value = first

    def fetchall(self):
        return list(self.rows)

    def scalar(self):
        return self.scalar_value

    def first(self):
        return self.first_value


def test_pricing_basis_repair_rejects_unrecognized_values(monkeypatch):
    inspector = Mock()
    inspector.has_table.return_value = True
    bind = Mock()
    bind.execute.return_value = QueryResult(rows=[("UNKNOWN", 1)])
    create_constraint = Mock()
    monkeypatch.setattr(migration, "_inspector", lambda: inspector)
    monkeypatch.setattr(migration, "_column_names", lambda _table: {"pricing_basis"})
    monkeypatch.setattr(migration, "_bind", lambda: bind)
    monkeypatch.setattr(migration.op, "create_check_constraint", create_constraint)

    with pytest.raises(RuntimeError, match="unsupported or NULL values"):
        migration._ensure_pricing_basis_constraint()

    create_constraint.assert_not_called()


def test_warehouse_repair_rejects_duplicate_default_warehouses(monkeypatch):
    inspector = Mock()
    inspector.has_table.return_value = True
    inspector.get_columns.return_value = [{"name": "is_default_for_branch"}]
    inspector.get_indexes.return_value = []
    bind = Mock()
    bind.execute.return_value = QueryResult(first=("company-1", "branch-1"))
    create_index = Mock()
    monkeypatch.setattr(migration, "_inspector", lambda: inspector)
    monkeypatch.setattr(migration, "_column_names", lambda _table: {"is_default_for_branch"})
    monkeypatch.setattr(migration, "_bind", lambda: bind)
    monkeypatch.setattr(migration.op, "create_index", create_index)

    with pytest.raises(RuntimeError, match="multiple active defaults"):
        migration._ensure_warehouse_schema()

    create_index.assert_not_called()
