"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : DB Migration — CRM Pipeline Expansion (Leads, Opportunities, Campaigns, Support Tickets, Activities)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 12.14.0
Created      : 2026-07-28

Revision ID: v1214_crm_expansion
Revises: v1213_accounting_expansion
Create Date: 2026-07-28 14:20:00

DBP Reference: SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.3 — CRM
Milestone 3 Tasks C-1 through C-5
- crm_leads
- crm_opportunities
- crm_campaigns
- crm_support_tickets
- crm_ticket_comments
- crm_customer_activities
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1214_crm_expansion'
down_revision = 'v1213_accounting_expansion'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. crm_leads
    op.create_table(
        'crm_leads',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('lead_no', sa.String(length=100), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('company_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('mobile', sa.String(length=20), nullable=True),
        sa.Column('lead_source', sa.String(length=50), nullable=False, server_default='Website'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='NEW'),
        sa.Column('assigned_to', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lead_no')
    )
    op.create_index('ix_crm_leads_email', 'crm_leads', ['email'], unique=False)
    op.create_index('ix_crm_leads_mobile', 'crm_leads', ['mobile'], unique=False)

    # 2. crm_opportunities
    op.create_table(
        'crm_opportunities',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('opp_no', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('lead_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=True),
        sa.Column('stage', sa.String(length=50), nullable=False, server_default='PROSPECTING'),
        sa.Column('probability_percent', sa.Numeric(precision=5, scale=2), nullable=False, server_default='10.00'),
        sa.Column('expected_revenue', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('expected_close_date', sa.Date(), nullable=True),
        sa.Column('assigned_to', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['lead_id'], ['crm_leads.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('opp_no')
    )

    # 3. crm_campaigns
    op.create_table(
        'crm_campaigns',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('campaign_no', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('campaign_type', sa.String(length=50), nullable=False, server_default='EMAIL'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='PLANNING'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('budget', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('actual_cost', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campaign_no')
    )

    # 4. crm_support_tickets
    op.create_table(
        'crm_support_tickets',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('ticket_no', sa.String(length=100), nullable=False),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='PRODUCT'),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='MEDIUM'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='OPEN'),
        sa.Column('assigned_to', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_no')
    )
    op.create_index('ix_crm_support_tickets_customer_id', 'crm_support_tickets', ['customer_id'], unique=False)

    # 5. crm_ticket_comments
    op.create_table(
        'crm_ticket_comments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('ticket_id', sa.String(length=50), nullable=False),
        sa.Column('author_name', sa.String(length=100), nullable=False),
        sa.Column('comment_text', sa.Text(), nullable=False),
        sa.Column('is_internal', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['ticket_id'], ['crm_support_tickets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_ticket_comments_ticket_id', 'crm_ticket_comments', ['ticket_id'], unique=False)

    # 6. crm_customer_activities
    op.create_table(
        'crm_customer_activities',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('customer_id', sa.String(length=50), nullable=True),
        sa.Column('lead_id', sa.String(length=50), nullable=True),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('summary', sa.String(length=255), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('activity_date', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['lead_id'], ['crm_leads.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_customer_activities_customer_id', 'crm_customer_activities', ['customer_id'], unique=False)
    op.create_index('ix_crm_customer_activities_lead_id', 'crm_customer_activities', ['lead_id'], unique=False)


def downgrade() -> None:
    op.drop_table('crm_customer_activities')
    op.drop_table('crm_ticket_comments')
    op.drop_table('crm_support_tickets')
    op.drop_table('crm_campaigns')
    op.drop_table('crm_opportunities')
    op.drop_table('crm_leads')
