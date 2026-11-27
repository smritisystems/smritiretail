import sqlalchemy as sa

_VERSION_TABLE = "alembic_version"
_VERSION_COLUMN = "version_num"
_VERSION_LENGTH = 64


def ensure_version_table_capacity(connection) -> None:
    if connection.dialect.name != "postgresql":
        raise RuntimeError("Alembic version-table preparation requires PostgreSQL.")

    inspector = sa.inspect(connection)
    if not inspector.has_table(_VERSION_TABLE):
        connection.execute(
            sa.text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(64) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            )
        )
        return

    columns = {
        column["name"]: column for column in inspector.get_columns(_VERSION_TABLE)
    }
    version_column = columns.get(_VERSION_COLUMN)
    if version_column is None:
        raise RuntimeError("alembic_version is missing its version_num column.")

    current_length = getattr(version_column["type"], "length", None)
    if current_length is None or current_length < _VERSION_LENGTH:
        connection.execute(
            sa.text(
                "ALTER TABLE alembic_version "
                "ALTER COLUMN version_num TYPE VARCHAR(64)"
            )
        )
