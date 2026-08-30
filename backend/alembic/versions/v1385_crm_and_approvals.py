"""v1385 -- CRM and Approvals module tables.

Revision ID: v1385_crm_and_approvals
Revises: v1384_company_code_constraint
Create Date: 2026-08-30 00:00:00.000000

Project      : SMRITI Retail OS
Author       : Migration Integrity Protocol
Description  : Add CRM (leads, opportunities, campaigns, activities) and Approvals (policies, requests, actions) module tables for v3.25.0 canonical schema.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v1385_crm'
down_revision = 'v1384_company_code_constraint'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # crm_leads - SMRITI Commercial Growth Engine Lead Master
    op.create_table(
        'crm_leads',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('lead_no', sa.String(50), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('mobile', sa.String(30), nullable=True),
        sa.Column('lead_source', sa.String(50), nullable=False, server_default='DIRECT'),
        sa.Column('status', sa.String(30), nullable=False, server_default='NEW'),
        sa.Column('assigned_to', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lead_no', name='uq_crm_leads_lead_no'),
        schema='public'
    )
    op.create_index(op.f('ix_crm_leads_email'), 'crm_leads', ['email'], unique=False, schema='public')
    op.create_index(op.f('ix_crm_leads_mobile'), 'crm_leads', ['mobile'], unique=False, schema='public')

    # crm_opportunities - SMRITI Commercial Growth Engine Deal Pipeline
    op.create_table(
        'crm_opportunities',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('opp_no', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('lead_id', sa.String(50), nullable=True),
        sa.Column('customer_id', sa.String(50), nullable=True),
        sa.Column('stage', sa.String(50), nullable=False, server_default='PROSPECTING'),
        sa.Column('probability_percent', sa.Numeric(5, 2), nullable=False, server_default='10.00'),
        sa.Column('expected_revenue', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('expected_close_date', sa.Date(), nullable=True),
        sa.Column('assigned_to', sa.String(50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('opp_no', name='uq_crm_opp_no'),
        sa.ForeignKeyConstraint(['lead_id'], ['crm_leads.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        schema='public'
    )
    op.create_index(op.f('ix_crm_opportunities_lead_id'), 'crm_opportunities', ['lead_id'], unique=False, schema='public')
    op.create_index(op.f('ix_crm_opportunities_customer_id'), 'crm_opportunities', ['customer_id'], unique=False, schema='public')

    # crm_campaigns - Marketing & Outreach
    op.create_table(
        'crm_campaigns',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('campaign_no', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('campaign_type', sa.String(50), nullable=False, server_default='SMS'),
        sa.Column('status', sa.String(30), nullable=False, server_default='PLANNED'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('budget', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('actual_cost', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campaign_no', name='uq_crm_campaign_no'),
        schema='public'
    )

    # crm_customer_activities - Touchpoint Log
    op.create_table(
        'crm_customer_activities',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('customer_id', sa.String(50), nullable=True),
        sa.Column('lead_id', sa.String(50), nullable=True),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('summary', sa.String(255), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('activity_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lead_id'], ['crm_leads.id'], ondelete='CASCADE'),
        schema='public'
    )
    op.create_index(op.f('ix_crm_customer_activities_customer_id'), 'crm_customer_activities', ['customer_id'], unique=False, schema='public')
    op.create_index(op.f('ix_crm_customer_activities_lead_id'), 'crm_customer_activities', ['lead_id'], unique=False, schema='public')

    # approval_policies - Governance thresholds
    op.create_table(
        'approval_policies',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False),
        sa.Column('min_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('max_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('required_role', sa.String(50), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_approval_policies_code'),
        schema='public'
    )
    op.create_index(op.f('ix_approval_policies_document_type'), 'approval_policies', ['document_type'], unique=False, schema='public')

    # approval_requests - State machine for approvals
    op.create_table(
        'approval_requests',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('request_no', sa.String(100), nullable=False),
        sa.Column('reference_doc_type', sa.String(50), nullable=False),
        sa.Column('reference_doc_id', sa.String(50), nullable=False),
        sa.Column('policy_id', sa.String(50), nullable=True),
        sa.Column('document_amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('requested_by', sa.String(100), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='PENDING'),
        sa.Column('current_assigned_role', sa.String(50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_no', name='uq_approval_requests_no'),
        sa.ForeignKeyConstraint(['policy_id'], ['approval_policies.id'], ondelete='SET NULL'),
        schema='public'
    )
    op.create_index(op.f('ix_approval_requests_reference_doc_type'), 'approval_requests', ['reference_doc_type'], unique=False, schema='public')

    # approval_actions - Audit ledger
    op.create_table(
        'approval_actions',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('request_id', sa.String(50), nullable=False),
        sa.Column('action', sa.String(30), nullable=False),
        sa.Column('action_by', sa.String(100), nullable=False),
        sa.Column('action_by_role', sa.String(50), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('action_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['request_id'], ['approval_requests.id'], ondelete='CASCADE'),
        schema='public'
    )
    op.create_index(op.f('ix_approval_actions_request_id'), 'approval_actions', ['request_id'], unique=False, schema='public')


def downgrade() -> None:
    op.drop_table('approval_actions', schema='public')
    op.drop_table('approval_requests', schema='public')
    op.drop_table('approval_policies', schema='public')
    op.drop_table('crm_customer_activities', schema='public')
    op.drop_table('crm_campaigns', schema='public')
    op.drop_table('crm_opportunities', schema='public')
    op.drop_table('crm_leads', schema='public')
