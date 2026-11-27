from unittest.mock import Mock

import pytest
import sqlalchemy as sa

from app.db.alembic_version_table import ensure_version_table_capacity


def _connection(dialect_name="postgresql"):
    connection = Mock()
    connection.dialect.name = dialect_name
    connection.execute = Mock()
    return connection


def test_version_table_is_created_with_capacity_when_missing(monkeypatch):
    inspector = Mock()
    inspector.has_table.return_value = False
    monkeypatch.setattr(sa, "inspect", lambda _connection: inspector)
    connection = _connection()

    ensure_version_table_capacity(connection)

    statement = str(connection.execute.call_args.args[0])
    assert "CREATE TABLE alembic_version" in statement
    assert "VARCHAR(64)" in statement


def test_existing_short_version_column_is_widened(monkeypatch):
    inspector = Mock()
    inspector.has_table.return_value = True
    inspector.get_columns.return_value = [
        {"name": "version_num", "type": sa.String(32)}
    ]
    monkeypatch.setattr(sa, "inspect", lambda _connection: inspector)
    connection = _connection()

    ensure_version_table_capacity(connection)

    statement = str(connection.execute.call_args.args[0])
    assert "ALTER TABLE alembic_version" in statement
    assert "VARCHAR(64)" in statement


def test_existing_version_column_with_capacity_is_unchanged(monkeypatch):
    inspector = Mock()
    inspector.has_table.return_value = True
    inspector.get_columns.return_value = [
        {"name": "version_num", "type": sa.String(64)}
    ]
    monkeypatch.setattr(sa, "inspect", lambda _connection: inspector)
    connection = _connection()

    ensure_version_table_capacity(connection)

    connection.execute.assert_not_called()


def test_version_table_preparation_rejects_non_postgresql():
    with pytest.raises(RuntimeError, match="requires PostgreSQL"):
        ensure_version_table_capacity(_connection("sqlite"))
