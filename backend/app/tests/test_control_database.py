"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control DB Physical Isolation & Security Authorization Test Suite
"""

import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.db.control_base import ControlBase
from app.db.base import BaseEntity
from app.models.control import (
    ControlCompany,
    ControlCompanyDatabase,
    DatabaseRegistryStatus,
    ControlUser,
    ControlUserCompanyAssignment,
    ControlCapabilityAssignment,
    ControlSecurityAudit,
    ControlSystemConfig,
)
from app.services.control_database_registry import ControlDatabaseRegistryService

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def control_db_session():
    """
    Creates an isolated test engine for Control DB schema testing on PostgreSQL.
    """
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(ControlBase.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(ControlBase.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_control_base_metadata_decoupled_from_company_base():
    """
    SECURITY TEST 1: ControlBase.metadata must be 100% distinct from BaseEntity.metadata.
    Guarantees no accidental metadata overlap between Control DB and Company DBs.
    """
    control_tables = set(ControlBase.metadata.tables.keys())
    company_tables = set(BaseEntity.metadata.tables.keys())

    # Ensure metadata objects are not identical
    assert ControlBase.metadata is not BaseEntity.metadata
    assert len(control_tables) > 0
    assert "control_companies" in control_tables
    assert "control_company_databases" in control_tables
    assert "control_users" in control_tables

    # Operational tables like products, sales_invoices MUST NOT be in ControlBase
    assert "products" not in control_tables
    assert "sales_invoices" not in control_tables
    assert "purchase_orders" not in control_tables


@pytest.mark.asyncio
async def test_database_credentials_never_appear_in_public_dict(control_db_session: AsyncSession):
    """
    SECURITY TEST 2: ControlCompanyDatabase.to_public_dict() must never expose
    encrypted_credentials, secrets_ref, db_user, or connection parameters.
    """
    company = ControlCompany(id="comp-001", company_code="SMR001", name="SMR Retail Ltd")
    db_entry = ControlCompanyDatabase(
        id="cdb-test-001",
        company_id=company.id,
        company_code=company.company_code,
        db_identifier="smriti_company_smr001",
        db_host="db.internal.smritibooks.com",
        db_port=5432,
        db_name="smriti_company_smr001",
        db_user="super_secret_db_user",
        encrypted_credentials="ENC:super_secret_password_hash_123",
        secrets_ref="arn:aws:secretsmanager:us-east-1:123456789012:secret:db_smr001",
        status=DatabaseRegistryStatus.ACTIVE.value,
        schema_revision="v1502_tenant_prod_sku",
        schema_fingerprint="FINGERPRINT_HASH_ABC123",
    )
    control_db_session.add_all([company, db_entry])
    await control_db_session.commit()

    public_dict = db_entry.to_public_dict()

    # MUST NOT expose secret attributes
    assert "encrypted_credentials" not in public_dict
    assert "secrets_ref" not in public_dict
    assert "db_user" not in public_dict
    assert "db_host" not in public_dict
    assert "db_port" not in public_dict
    assert "db_name" not in public_dict

    # MUST expose safe governance metadata
    assert public_dict["company_code"] == "SMR001"
    assert public_dict["db_identifier"] == "smriti_company_smr001"
    assert public_dict["status"] == "ACTIVE"
    assert public_dict["schema_revision"] == "v1502_tenant_prod_sku"
    assert public_dict["schema_fingerprint"] == "FINGERPRINT_HASH_ABC123"


@pytest.mark.asyncio
async def test_user_cannot_access_unassigned_company(control_db_session: AsyncSession):
    """
    SECURITY TEST 3: User assigned to Company A cannot access Company B.
    Attempts to verify authorization for an unassigned company code MUST return False.
    """
    # Create test user
    user = ControlUser(
        id="usr-jawahar-001",
        username="jawahar_mallah",
        hashed_password="hashed_pass_value",
        is_active=True,
    )
    # Create Company A and Company B
    comp_a = ControlCompany(id="comp-a", company_code="COMPANY_A", name="Company A Ltd")
    comp_b = ControlCompany(id="comp-b", company_code="COMPANY_B", name="Company B Ltd")
    
    # Assign user ONLY to Company A
    assignment_a = ControlUserCompanyAssignment(
        id="uca-001",
        user_id=user.id,
        company_id=comp_a.id,
        company_code=comp_a.company_code,
        role_name="MANAGER",
    )
    
    control_db_session.add_all([user, comp_a, comp_b, assignment_a])
    await control_db_session.commit()

    # User accesses Company A → Allowed (True)
    access_a = await ControlDatabaseRegistryService.verify_user_company_access(
        control_db_session, user.id, "COMPANY_A"
    )
    assert access_a is True

    # User accesses Company B → Denied (False)
    access_b = await ControlDatabaseRegistryService.verify_user_company_access(
        control_db_session, user.id, "COMPANY_B"
    )
    assert access_b is False


@pytest.mark.asyncio
async def test_company_code_cannot_bypass_authorization(control_db_session: AsyncSession):
    """
    SECURITY TEST 4: Arbitrary company_code parameters supplied by unassigned user fail authorization.
    """
    user_attacker = ControlUser(
        id="usr-attacker-999",
        username="attacker_user",
        hashed_password="hashed_pass_value",
        is_active=True,
    )
    comp_target = ControlCompany(id="comp-target", company_code="TARGET_CO", name="Target Co")
    control_db_session.add_all([user_attacker, comp_target])
    await control_db_session.commit()

    # Attacker tries to pass company_code="TARGET_CO"
    has_access = await ControlDatabaseRegistryService.verify_user_company_access(
        control_db_session, user_attacker.id, "TARGET_CO"
    )
    assert has_access is False


@pytest.mark.asyncio
async def test_database_registry_status_enum_governance(control_db_session: AsyncSession):
    """
    GOVERNANCE TEST 5: Verifies state transitions across DatabaseRegistryStatus enums.
    """
    db_entry = await ControlDatabaseRegistryService.register_company_database(
        db=control_db_session,
        company_id="comp-reg-001",
        company_code="REG001",
        company_name="Registry Test Co",
        db_identifier="smriti_company_reg001",
        db_host="localhost",
    )

    assert db_entry.status == DatabaseRegistryStatus.PROVISIONING.value

    # Update to ACTIVE
    updated = await ControlDatabaseRegistryService.update_database_status(
        db=control_db_session,
        company_code="REG001",
        new_status=DatabaseRegistryStatus.ACTIVE,
        schema_revision="v1502_tenant_prod_sku",
        schema_fingerprint="FINGERPRINT_VERIFIED_999",
    )
    assert updated.status == "ACTIVE"
    assert updated.schema_fingerprint == "FINGERPRINT_VERIFIED_999"

    # Update to DRIFTED
    drifted = await ControlDatabaseRegistryService.update_database_status(
        db=control_db_session,
        company_code="REG001",
        new_status=DatabaseRegistryStatus.DRIFTED,
    )
    assert drifted.status == "DRIFTED"
