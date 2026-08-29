"""add_users_and_token_blacklist

Revision ID: 8cf33df7b76a
Revises: 931451e6eea2
Create Date: 2026-07-11 19:30:35.714011

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8cf33df7b76a'
down_revision: Union[str, Sequence[str], None] = '931451e6eea2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    enum_names = {row[0] for row in bind.execute(sa.text("SELECT typname FROM pg_type WHERE typtype = 'e'"))}

    if {'users', 'refresh_token_blacklist'}.issubset(table_names) and 'userrole' in enum_names:
        return

    if 'userrole' not in enum_names:
        op.execute("CREATE TYPE userrole AS ENUM ('SYSADMIN', 'MANAGER', 'CASHIER', 'VIEWER')")

    if 'users' not in table_names:
        op.execute(
            """
            CREATE TABLE users (
                id VARCHAR(50) NOT NULL,
                uuid VARCHAR(36) NOT NULL,
                username VARCHAR(80) NOT NULL,
                email VARCHAR(255) NULL,
                mobile VARCHAR(20) NULL,
                hashed_password VARCHAR(255) NOT NULL,
                role userrole NOT NULL,
                is_active BOOLEAN NOT NULL,
                is_deleted BOOLEAN NOT NULL,
                company_id VARCHAR(50) NULL,
                branch_id VARCHAR(50) NULL,
                created_at TIMESTAMPTZ NOT NULL,
                modified_at TIMESTAMPTZ NOT NULL,
                CONSTRAINT users_pkey PRIMARY KEY (id),
                CONSTRAINT users_uuid_key UNIQUE (uuid),
                CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
                CONSTRAINT users_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
            )
            """
        )

    # Create only the indexes that are still absent so reruns are safe.
    user_index_names = set(inspector.get_index_names('users')) if 'users' in table_names or 'users' in inspector.get_table_names() else set()
    if 'ix_users_branch_id' not in user_index_names:
        op.create_index(op.f('ix_users_branch_id'), 'users', ['branch_id'], unique=False)
    if 'ix_users_company_id' not in user_index_names:
        op.create_index(op.f('ix_users_company_id'), 'users', ['company_id'], unique=False)
    if 'ix_users_email' not in user_index_names:
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    if 'ix_users_username' not in user_index_names:
        op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    if 'refresh_token_blacklist' not in table_names:
        op.execute(
            """
            CREATE TABLE refresh_token_blacklist (
                id VARCHAR(36) NOT NULL,
                token_jti VARCHAR(255) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                revoked_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                CONSTRAINT refresh_token_blacklist_pkey PRIMARY KEY (id),
                CONSTRAINT refresh_token_blacklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

    blacklist_index_names = set(inspector.get_index_names('refresh_token_blacklist')) if 'refresh_token_blacklist' in table_names or 'refresh_token_blacklist' in inspector.get_table_names() else set()
    if 'ix_refresh_token_blacklist_token_jti' not in blacklist_index_names:
        op.create_index(op.f('ix_refresh_token_blacklist_token_jti'), 'refresh_token_blacklist', ['token_jti'], unique=True)
    if 'ix_refresh_token_blacklist_user_id' not in blacklist_index_names:
        op.create_index(op.f('ix_refresh_token_blacklist_user_id'), 'refresh_token_blacklist', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS refresh_token_blacklist CASCADE;")
    op.execute("DROP TABLE IF EXISTS users CASCADE;")
    op.execute("DROP TYPE IF EXISTS userrole CASCADE;")

