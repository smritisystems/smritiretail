"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""rename_policies_to_permission_sets

Revision ID: 6a5a1f89c59e
Revises: 5922562b72ad
Create Date: 2026-07-19 18:03:37.480574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a5a1f89c59e'
down_revision: Union[str, Sequence[str], None] = '5922562b72ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Drop old indices
    op.drop_index('ix_smriti_policies_code', table_name='smriti_policies')
    op.drop_index('ix_smriti_policies_tenant_id', table_name='smriti_policies')
    op.drop_index('ix_smriti_role_policies_role_id', table_name='smriti_role_policies')
    op.drop_index('ix_smriti_role_policies_policy_id', table_name='smriti_role_policies')
    op.drop_index('ix_smriti_policy_permissions_policy_id', table_name='smriti_policy_permissions')
    op.drop_index('ix_smriti_policy_permissions_permission_id', table_name='smriti_policy_permissions')
    op.drop_index('ix_smriti_policy_permissions_tenant_id', table_name='smriti_policy_permissions')

    # 2. Rename tables
    op.rename_table('smriti_policies', 'smriti_permission_sets')
    op.rename_table('smriti_role_policies', 'smriti_role_permission_sets')
    op.rename_table('smriti_policy_permissions', 'smriti_permission_set_permissions')

    # 3. Rename columns
    op.alter_column('smriti_role_permission_sets', 'policy_id', new_column_name='permission_set_id')
    op.alter_column('smriti_permission_set_permissions', 'policy_id', new_column_name='permission_set_id')

    # 4. Create new indices
    op.create_index(op.f('ix_smriti_permission_sets_code'), 'smriti_permission_sets', ['code'], unique=True)
    op.create_index(op.f('ix_smriti_permission_sets_tenant_id'), 'smriti_permission_sets', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_smriti_role_permission_sets_role_id'), 'smriti_role_permission_sets', ['role_id'], unique=False)
    op.create_index(op.f('ix_smriti_role_permission_sets_permission_set_id'), 'smriti_role_permission_sets', ['permission_set_id'], unique=False)
    op.create_index(op.f('ix_smriti_permission_set_permissions_permission_set_id'), 'smriti_permission_set_permissions', ['permission_set_id'], unique=False)
    op.create_index(op.f('ix_smriti_permission_set_permissions_permission_id'), 'smriti_permission_set_permissions', ['permission_id'], unique=False)
    op.create_index(op.f('ix_smriti_permission_set_permissions_tenant_id'), 'smriti_permission_set_permissions', ['tenant_id'], unique=False)

    # 5. Clean up other tenant_id fields if present
    op.drop_index('ix_master_types_tenant_id', table_name='master_types')
    op.drop_column('master_types', 'tenant_id')
    op.drop_index('ix_master_values_tenant_id', table_name='master_values')
    op.drop_column('master_values', 'tenant_id')
    op.drop_index('ix_sales_invoice_items_tenant_id', table_name='sales_invoice_items')
    op.drop_column('sales_invoice_items', 'tenant_id')
    op.drop_index('ix_sales_order_items_tenant_id', table_name='sales_order_items')
    op.drop_column('sales_order_items', 'tenant_id')
    op.drop_index('ix_sales_quotation_items_tenant_id', table_name='sales_quotation_items')
    op.drop_column('sales_quotation_items', 'tenant_id')
    op.drop_index('ix_sales_return_items_tenant_id', table_name='sales_return_items')
    op.drop_column('sales_return_items', 'tenant_id')

    # Update index types to unique=True for security code lookups
    op.drop_constraint('uq_smriti_permissions_code', 'smriti_permissions', type_='unique')
    op.drop_index('ix_smriti_permissions_code', table_name='smriti_permissions')
    op.create_index(op.f('ix_smriti_permissions_code'), 'smriti_permissions', ['code'], unique=True)
    op.drop_constraint('uq_smriti_roles_code', 'smriti_roles', type_='unique')
    op.drop_index('ix_smriti_roles_code', table_name='smriti_roles')
    op.create_index(op.f('ix_smriti_roles_code'), 'smriti_roles', ['code'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_smriti_roles_code', 'smriti_roles', type_='unique')
    op.drop_index(op.f('ix_smriti_roles_code'), table_name='smriti_roles')
    op.create_index('ix_smriti_roles_code', 'smriti_roles', ['code'], unique=False)
    op.create_unique_constraint('uq_smriti_roles_code', 'smriti_roles', ['code'])
    op.drop_constraint('uq_smriti_permissions_code', 'smriti_permissions', type_='unique')
    op.drop_index(op.f('ix_smriti_permissions_code'), table_name='smriti_permissions')
    op.create_index('ix_smriti_permissions_code', 'smriti_permissions', ['code'], unique=False)
    op.create_unique_constraint('uq_smriti_permissions_code', 'smriti_permissions', ['code'])

    # Add back tenant_id columns
    op.add_column('sales_return_items', sa.Column('tenant_id', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.create_index('ix_sales_return_items_tenant_id', 'sales_return_items', ['tenant_id'], unique=False)
    op.add_column('sales_quotation_items', sa.Column('tenant_id', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.create_index('ix_sales_quotation_items_tenant_id', 'sales_quotation_items', ['tenant_id'], unique=False)
    op.add_column('sales_order_items', sa.Column('tenant_id', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.create_index('ix_sales_order_items_tenant_id', 'sales_order_items', ['tenant_id'], unique=False)
    op.add_column('sales_invoice_items', sa.Column('tenant_id', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.create_index('ix_sales_invoice_items_tenant_id', 'sales_invoice_items', ['tenant_id'], unique=False)
    op.add_column('master_values', sa.Column('tenant_id', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.create_index('ix_master_values_tenant_id', 'master_values', ['tenant_id'], unique=False)
    op.add_column('master_types', sa.Column('tenant_id', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.create_index('ix_master_types_tenant_id', 'master_types', ['tenant_id'], unique=False)

    # 1. Drop new indices
    op.drop_index(op.f('ix_smriti_permission_set_permissions_tenant_id'), table_name='smriti_permission_set_permissions')
    op.drop_index(op.f('ix_smriti_permission_set_permissions_permission_id'), table_name='smriti_permission_set_permissions')
    op.drop_index(op.f('ix_smriti_permission_set_permissions_permission_set_id'), table_name='smriti_permission_set_permissions')
    op.drop_index(op.f('ix_smriti_role_permission_sets_permission_set_id'), table_name='smriti_role_permission_sets')
    op.drop_index(op.f('ix_smriti_role_permission_sets_role_id'), table_name='smriti_role_permission_sets')
    op.drop_index(op.f('ix_smriti_permission_sets_tenant_id'), table_name='smriti_permission_sets')
    op.drop_index(op.f('ix_smriti_permission_sets_code'), table_name='smriti_permission_sets')

    # 2. Rename columns back
    op.alter_column('smriti_permission_set_permissions', 'permission_set_id', new_column_name='policy_id')
    op.alter_column('smriti_role_permission_sets', 'permission_set_id', new_column_name='policy_id')

    # 3. Rename tables back
    op.rename_table('smriti_permission_set_permissions', 'smriti_policy_permissions')
    op.rename_table('smriti_role_permission_sets', 'smriti_role_policies')
    op.rename_table('smriti_permission_sets', 'smriti_policies')

    # 4. Recreate old indices
    op.create_index('ix_smriti_policy_permissions_tenant_id', 'smriti_policy_permissions', ['tenant_id'], unique=False)
    op.create_index('ix_smriti_policy_permissions_permission_id', 'smriti_policy_permissions', ['permission_id'], unique=False)
    op.create_index('ix_smriti_policy_permissions_policy_id', 'smriti_policy_permissions', ['policy_id'], unique=False)
    op.create_index('ix_smriti_role_policies_policy_id', 'smriti_role_policies', ['policy_id'], unique=False)
    op.create_index('ix_smriti_role_policies_role_id', 'smriti_role_policies', ['role_id'], unique=False)
    op.create_index('ix_smriti_policies_tenant_id', 'smriti_policies', ['tenant_id'], unique=False)
    op.create_index('ix_smriti_policies_code', 'smriti_policies', ['code'], unique=False)
