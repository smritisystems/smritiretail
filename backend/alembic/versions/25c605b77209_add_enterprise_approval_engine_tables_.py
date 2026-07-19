"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Revision ID: 25c605b77209
Revises: 382862b3ec00
Create Date: 2026-07-20
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '25c605b77209'
down_revision: Union[str, Sequence[str], None] = '382862b3ec00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Policies
    op.create_table(
        'smriti_approval_policies',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('scope_type', sa.String(length=30), server_default='GLOBAL', nullable=True),
        sa.Column('scope_id', sa.String(length=50), nullable=True),
        sa.Column('priority', sa.Integer(), server_default='10', nullable=True),
        sa.Column('policy_version', sa.Integer(), server_default='1', nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )

    # 2. Matrices
    op.create_table(
        'smriti_approval_matrices',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('policy_id', sa.String(length=50), nullable=False),
        sa.Column('matrix_name', sa.String(length=100), nullable=False),
        sa.Column('min_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=True),
        sa.Column('max_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.ForeignKeyConstraint(['policy_id'], ['smriti_approval_policies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Steps
    op.create_table(
        'smriti_approval_steps',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('matrix_id', sa.String(length=50), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('step_name', sa.String(length=100), nullable=False),
        sa.Column('strategy', sa.String(length=30), server_default='SEQUENTIAL', nullable=True),
        sa.Column('sla_hours', sa.Integer(), server_default='24', nullable=True),
        sa.Column('auto_escalate_role_id', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['matrix_id'], ['smriti_approval_matrices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Conditions
    op.create_table(
        'smriti_approval_conditions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('step_id', sa.String(length=50), nullable=False),
        sa.Column('expression_dsl', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['step_id'], ['smriti_approval_steps.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Assignments
    op.create_table(
        'smriti_approval_assignments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('step_id', sa.String(length=50), nullable=False),
        sa.Column('role_id', sa.String(length=50), nullable=True),
        sa.Column('user_id', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['step_id'], ['smriti_approval_steps.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 6. Requests
    op.create_table(
        'smriti_approval_requests',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('request_no', sa.String(length=50), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('document_id', sa.String(length=50), nullable=False),
        sa.Column('document_hash', sa.String(length=64), nullable=False),
        sa.Column('policy_version', sa.Integer(), server_default='1', nullable=True),
        sa.Column('requester_id', sa.String(length=50), nullable=False),
        sa.Column('current_step_number', sa.Integer(), server_default='1', nullable=True),
        sa.Column('status', sa.String(length=30), server_default='SUBMITTED', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_no')
    )

    # 7. Actions
    op.create_table(
        'smriti_approval_actions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('request_id', sa.String(length=50), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=30), nullable=False),
        sa.Column('action_by', sa.String(length=50), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('correlation_id', sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['smriti_approval_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 8. Histories
    op.create_table(
        'smriti_approval_histories',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('request_id', sa.String(length=50), nullable=False),
        sa.Column('state_from', sa.String(length=30), nullable=False),
        sa.Column('state_to', sa.String(length=30), nullable=False),
        sa.Column('transition_by', sa.String(length=50), nullable=False),
        sa.Column('transition_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['smriti_approval_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 9. Delegations
    op.create_table(
        'smriti_approval_delegations',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('delegator_id', sa.String(length=50), nullable=False),
        sa.Column('delegate_id', sa.String(length=50), nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 10. Escalations
    op.create_table(
        'smriti_approval_escalations',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('request_id', sa.String(length=50), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('escalated_from_role', sa.String(length=50), nullable=False),
        sa.Column('escalated_to_role', sa.String(length=50), nullable=False),
        sa.Column('trigger_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['smriti_approval_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 11. Comments
    op.create_table(
        'smriti_approval_comments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('request_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('comment', sa.Text(), nullable=False),
        sa.Column('attachments_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['smriti_approval_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 12. Outbox
    op.create_table(
        'smriti_approval_outbox',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=50), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('payload_json', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='PENDING', nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    tables = [
        'smriti_approval_outbox',
        'smriti_approval_comments',
        'smriti_approval_escalations',
        'smriti_approval_delegations',
        'smriti_approval_histories',
        'smriti_approval_actions',
        'smriti_approval_requests',
        'smriti_approval_assignments',
        'smriti_approval_conditions',
        'smriti_approval_steps',
        'smriti_approval_matrices',
        'smriti_approval_policies',
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
