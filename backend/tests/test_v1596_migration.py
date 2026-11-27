import importlib.util
from pathlib import Path
from unittest.mock import Mock

import sqlalchemy as sa
import pytest


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "v1596_control_plane_capability_alignment.py"
)
spec = importlib.util.spec_from_file_location("v1596_migration", MIGRATION_PATH)
assert spec is not None and spec.loader is not None
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class QueryResult:
    def __init__(self, *, first=None):
        self.first_value = first

    def first(self):
        return self.first_value


class MigrationBind:
    def __init__(self, duplicate=None):
        self.duplicate = duplicate
        self.statements = []

    def execute(self, statement):
        sql = str(statement)
        self.statements.append(sql)
        if "GROUP BY uuid" in sql:
            return QueryResult(first=self.duplicate)
        return QueryResult()


def _existing_columns():
    return [
        {"name": "uuid", "nullable": True, "type": sa.String(36)},
        {"name": "company_id", "nullable": True, "type": sa.String(50)},
        {"name": "branch_id", "nullable": True, "type": sa.String(50)},
        {"name": "modified_at", "nullable": True, "type": sa.DateTime(timezone=True)},
        {"name": "created_by", "nullable": True, "type": sa.String(100)},
        {"name": "updated_by", "nullable": True, "type": sa.String(100)},
        {"name": "is_active", "nullable": True, "type": sa.Boolean()},
        {"name": "is_deleted", "nullable": False, "type": sa.Boolean()},
        {"name": "deleted_at", "nullable": True, "type": sa.DateTime(timezone=True)},
        {"name": "deleted_by", "nullable": True, "type": sa.String(100)},
        {"name": "version", "nullable": False, "type": sa.Integer()},
    ]


def _patch_inspection(monkeypatch, bind):
    inspector = Mock()
    inspector.get_columns.return_value = _existing_columns()
    inspector.get_unique_constraints.return_value = []
    inspector.get_indexes.return_value = []
    monkeypatch.setattr(migration.sa, "inspect", lambda _bind: inspector)
    monkeypatch.setattr(migration.op, "get_bind", lambda: bind)
    return inspector


def test_nullable_uuid_is_backfilled_and_constrained(monkeypatch):
    bind = MigrationBind()
    _patch_inspection(monkeypatch, bind)
    alter_column = Mock()
    create_index = Mock()
    monkeypatch.setattr(migration.op, "alter_column", alter_column)
    monkeypatch.setattr(migration.op, "create_index", create_index)

    migration._ensure_base_entity_columns("platform_capabilities")

    assert any("WHERE uuid IS NULL" in statement for statement in bind.statements)
    assert any(
        "SET is_active = TRUE WHERE is_active IS NULL" in statement
        for statement in bind.statements
    )
    assert any(
        call.kwargs.get("nullable") is False
        for call in alter_column.call_args_list
    )
    create_index.assert_called_once_with(
        "ix_platform_capabilities_uuid",
        "platform_capabilities",
        ["uuid"],
        unique=True,
    )


def test_duplicate_uuids_abort_before_unique_index_creation(monkeypatch):
    bind = MigrationBind(duplicate=("duplicate-uuid",))
    _patch_inspection(monkeypatch, bind)
    create_index = Mock()
    monkeypatch.setattr(migration.op, "alter_column", Mock())
    monkeypatch.setattr(migration.op, "create_index", create_index)

    with pytest.raises(RuntimeError, match="duplicate UUID values exist"):
        migration._ensure_base_entity_columns("platform_capabilities")

    create_index.assert_not_called()
