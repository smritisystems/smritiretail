"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Corporate Customer Merge & PAN Consolidation Test Suite (BD-2)
"""

import sys
import uuid
from pathlib import Path
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from app.api.deps import TenantContext
from app.models.auth import User, UserRole
from app.models.crm import (
    Customer,
    CustomerGSTRegistration,
    CustomerDeliveryLocation,
    CustomerBillingLocation,
    CustomerExternalIdentity,
    CustomerCompanyRelationship,
)
from app.models.audit import ComplianceImmutableAuditLog
from app.schemas.crm import (
    CustomerMergeRequest,
    CustomerMergeResponse,
)
from app.services.crm import CrmService
from app.api.v1.crm import merge_customers


def test_customer_merge_schema_serialization():
    """Verify CustomerMergeRequest and CustomerMergeResponse serialization and aliases."""
    req = CustomerMergeRequest(
        targetCustomerId="cust-target-001",
        sourceCustomerId="cust-source-002",
        reason="Corporate Group Consolidation",
    )
    assert req.target_customer_id == "cust-target-001"
    assert req.source_customer_id == "cust-source-002"
    assert req.reason == "Corporate Group Consolidation"

    resp = CustomerMergeResponse(
        targetCustomerId="cust-target-001",
        sourceCustomerId="cust-source-002",
        status="merged",
        message="Merged successfully",
        reassignedRecords={"sales_invoices": 14, "customer_delivery_locations": 2},
    )
    assert resp.target_customer_id == "cust-target-001"
    assert resp.reassigned_records["sales_invoices"] == 14
    dumped = resp.model_dump(by_alias=True)
    assert dumped["targetCustomerId"] == "cust-target-001"
    assert dumped["reassignedRecords"]["sales_invoices"] == 14


@pytest.mark.asyncio
async def test_merge_customer_self_merge_rejection():
    """BD-2: Assert attempting to merge a customer into itself raises HTTP 400."""
    db = AsyncMock()
    ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(db, ctx)

    with pytest.raises(HTTPException) as exc_info:
        await service.merge_customer("cust-001", "cust-001")
    assert exc_info.value.status_code == 400
    assert "Cannot merge customer into itself" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_merge_customer_target_or_source_not_found():
    """Assert non-existent target or source raises HTTP 404."""
    db = AsyncMock()
    ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(db, ctx)

    # 1. Target not found
    mock_res_empty = MagicMock()
    mock_res_empty.scalars.return_value.first.return_value = None
    db.execute.return_value = mock_res_empty

    with pytest.raises(HTTPException) as exc_info:
        await service.merge_customer("cust-target-none", "cust-source-001")
    assert exc_info.value.status_code == 404
    assert "Target customer 'cust-target-none' not found" in str(exc_info.value.detail)

    # 2. Source not found
    target_cust = Customer(id="cust-target-001", name="Target Master", pan_number="AABCR1234F")
    mock_res_target = MagicMock()
    mock_res_target.scalars.return_value.first.return_value = target_cust
    db.execute.side_effect = [mock_res_target, mock_res_empty]

    with pytest.raises(HTTPException) as exc_info:
        await service.merge_customer("cust-target-001", "cust-source-none")
    assert exc_info.value.status_code == 404
    assert "Source customer 'cust-source-none' not found" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_merge_customer_source_already_merged_rejection():
    """Assert attempting to merge an already merged source customer raises HTTP 400."""
    db = AsyncMock()
    ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(db, ctx)

    target_cust = Customer(id="cust-target-001", name="Target Master", pan_number="AABCR1234F")
    source_cust = Customer(id="cust-source-001", name="Already Merged", status="Merged", pan_number="AABCR1234F")

    mock_res_t = MagicMock()
    mock_res_t.scalars.return_value.first.return_value = target_cust
    mock_res_s = MagicMock()
    mock_res_s.scalars.return_value.first.return_value = source_cust

    db.execute.side_effect = [mock_res_t, mock_res_s]

    with pytest.raises(HTTPException) as exc_info:
        await service.merge_customer("cust-target-001", "cust-source-001")
    assert exc_info.value.status_code == 400
    assert "already been merged" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_merge_customer_pan_parity_guard_violation():
    """BD-2: Assert merging customers with distinct conflicting PANs raises HTTP 400."""
    db = AsyncMock()
    ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(db, ctx)

    target_cust = Customer(id="cust-target-001", name="Reliance Retail Ltd", pan_number="AABCR1234F")
    source_cust = Customer(id="cust-source-002", name="Tata Consumer Ltd", pan_number="BBBDT5678K")

    mock_res_t = MagicMock()
    mock_res_t.scalars.return_value.first.return_value = target_cust
    mock_res_s = MagicMock()
    mock_res_s.scalars.return_value.first.return_value = source_cust

    db.execute.side_effect = [mock_res_t, mock_res_s]

    with pytest.raises(HTTPException) as exc_info:
        await service.merge_customer("cust-target-001", "cust-source-002")
    assert exc_info.value.status_code == 400
    assert "BD-2 PAN Parity Violation" in str(exc_info.value.detail)
    assert "AABCR1234F" in str(exc_info.value.detail)
    assert "BBBDT5678K" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_merge_customer_full_consolidation_and_reassignment():
    """
    BD-2 Full Consolidation Test:
    - Same PAN or missing PAN adopted.
    - GST registrations consolidated.
    - Delivery and billing locations consolidated with collision resolution.
    - External identities merged.
    - Model C CustomerCompanyRelationships consolidated.
    - Operational tables updated.
    - Outstanding financial balance combined.
    - Source retired with audit notes.
    - WORM immutable audit trail recorded.
    """
    db = AsyncMock()
    ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(db, ctx)

    # Target Customer (missing email and GSTIN)
    target_cust = Customer(
        id="cust-master-101",
        code="CUST-MST-101",
        name="Apex Enterprises Master",
        pan_number="AABCA9999M",
        gst_number=None,
        email=None,
        outstanding=Decimal("45000.00"),
        status="Active",
        is_deleted=False,
    )
    # Target GST
    target_gst = CustomerGSTRegistration(id="gst-t-01", customer_id=target_cust.id, gstin="27AABCA9999M1Z5", is_deleted=False)
    target_cust.gst_registrations = [target_gst]

    # Target Delivery Location
    target_dl = CustomerDeliveryLocation(id="dl-t-01", customer_id=target_cust.id, store_code="STORE-MUM-01", is_deleted=False)
    target_cust.delivery_locations = [target_dl]

    # Target Billing Location
    target_bl = CustomerBillingLocation(id="bl-t-01", customer_id=target_cust.id, billing_store_code="BILL-MUM-01", is_deleted=False)
    target_cust.billing_locations = [target_bl]

    # Target External Identity
    target_ext = CustomerExternalIdentity(id="ext-t-01", customer_id=target_cust.id, source_system="SAP", external_code="SAP-999", is_deleted=False)
    target_cust.external_identities = [target_ext]

    # Target Model C CCR (COMP-001)
    target_ccr = CustomerCompanyRelationship(id="ccr-t-01", customer_id=target_cust.id, company_id="COMP-001", is_deleted=False)
    target_cust.company_relationships = [target_ccr]

    # Source Customer (carries same PAN, gstin, email, outstanding)
    source_cust = Customer(
        id="cust-source-202",
        code="CUST-SRC-202",
        name="Apex Branch Subsidiary",
        pan_number="AABCA9999M",
        gst_number="27AABCA9999M1Z5",
        email="billing@apexsubsidiary.com",
        outstanding=Decimal("15200.50"),
        status="Active",
        is_deleted=False,
    )
    # Source GST: one duplicate, one new
    source_gst_dup = CustomerGSTRegistration(id="gst-s-01", customer_id=source_cust.id, gstin="27AABCA9999M1Z5", is_deleted=False)
    source_gst_new = CustomerGSTRegistration(id="gst-s-02", customer_id=source_cust.id, gstin="29AABCA9999M1Z2", is_deleted=False)
    source_cust.gst_registrations = [source_gst_dup, source_gst_new]

    # Source DL: one colliding store code, one unique
    source_dl_coll = CustomerDeliveryLocation(id="dl-s-01", customer_id=source_cust.id, store_code="STORE-MUM-01", is_deleted=False)
    source_dl_uniq = CustomerDeliveryLocation(id="dl-s-02", customer_id=source_cust.id, store_code="STORE-DEL-02", is_deleted=False)
    source_cust.delivery_locations = [source_dl_coll, source_dl_uniq]

    # Source BL: one colliding billing store code
    source_bl_coll = CustomerBillingLocation(id="bl-s-01", customer_id=source_cust.id, billing_store_code="BILL-MUM-01", is_deleted=False)
    source_cust.billing_locations = [source_bl_coll]

    # Source Ext: one duplicate SAP, one new SHOPIFY
    source_ext_dup = CustomerExternalIdentity(id="ext-s-01", customer_id=source_cust.id, source_system="SAP", external_code="SAP-999", is_deleted=False)
    source_ext_new = CustomerExternalIdentity(id="ext-s-02", customer_id=source_cust.id, source_system="SHOPIFY", external_code="SHOP-777", is_deleted=False)
    source_cust.external_identities = [source_ext_dup, source_ext_new]

    # Source Model C CCR: one duplicate COMP-001, one new COMP-002
    source_ccr_dup = CustomerCompanyRelationship(id="ccr-s-01", customer_id=source_cust.id, company_id="COMP-001", is_deleted=False)
    source_ccr_new = CustomerCompanyRelationship(id="ccr-s-02", customer_id=source_cust.id, company_id="COMP-002", is_deleted=False)
    source_cust.company_relationships = [source_ccr_dup, source_ccr_new]

    mock_res_t = MagicMock()
    mock_res_t.scalars.return_value.first.return_value = target_cust
    mock_res_s = MagicMock()
    mock_res_s.scalars.return_value.first.return_value = source_cust

    # Operational table UPDATE mock
    mock_update_res = MagicMock()
    mock_update_res.rowcount = 5

    # Mock compliance audit predecessor
    mock_audit_res = MagicMock()
    mock_audit_res.scalars.return_value.first.return_value = None

    # Wire side effects for execute calls:
    # 1. target fetch, 2. source fetch, 3-13. operational tables, 14. last audit entry
    db.execute.side_effect = [
        mock_res_t,
        mock_res_s,
        mock_update_res,  # sales_invoices
        mock_update_res,  # sales_orders
        mock_update_res,  # sales_returns
        mock_update_res,  # customer_credit_ledger_entries
        mock_update_res,  # customer_purchase_orders
        mock_update_res,  # psv_parties
        mock_update_res,  # crm_customer_activities
        mock_update_res,  # crm_opportunities
        mock_update_res,  # loyalty_transactions
        mock_update_res,  # referral_relationships
        mock_update_res,  # loyalty_members
        mock_audit_res,   # last audit entry query
    ]

    response = await service.merge_customer(
        target_id=target_cust.id,
        source_id=source_cust.id,
        reason="Corporate BD-2 Consolidation",
        actor_user_id="usr-sysadmin-1",
        actor_role="SYSADMIN",
    )

    # 1. Response validation
    assert response.status == "merged"
    assert response.target_customer_id == target_cust.id
    assert response.source_customer_id == source_cust.id
    assert "successfully consolidated" in response.message

    # 2. Target profile adoption
    assert target_cust.gst_number == "27AABCA9999M1Z5"
    assert target_cust.email == "billing@apexsubsidiary.com"
    assert target_cust.outstanding == Decimal("60200.50")

    # 3. GST consolidation
    assert source_gst_dup.is_deleted is True
    assert source_gst_dup.status == "MERGED"
    assert source_gst_new.customer_id == target_cust.id
    assert source_gst_new.is_primary is False

    # 4. Delivery location collision resolution
    assert source_dl_coll.customer_id == target_cust.id
    assert source_dl_coll.store_code == f"STORE-MUM-01_{source_cust.id[:6].upper()}"
    assert source_dl_uniq.customer_id == target_cust.id
    assert source_dl_uniq.store_code == "STORE-DEL-02"

    # 5. Billing location collision resolution
    assert source_bl_coll.customer_id == target_cust.id
    assert source_bl_coll.billing_store_code == f"BILL-MUM-01_{source_cust.id[:6].upper()}"

    # 6. External identity consolidation
    assert source_ext_dup.is_deleted is True
    assert source_ext_dup.status == "MERGED"
    assert source_ext_new.customer_id == target_cust.id

    # 7. Model C Company Relationship consolidation
    assert source_ccr_dup.is_deleted is True
    assert source_ccr_dup.status == "Merged"
    assert source_ccr_new.customer_id == target_cust.id

    # 8. Source retirement
    assert source_cust.status == "Merged"
    assert source_cust.is_deleted is True
    assert source_cust.outstanding == Decimal("0.00")
    assert "MERGED into cust-master-101" in source_cust.profile_notes

    # 9. Audit trail verification
    added_entities = [call[0][0] for call in db.add.call_args_list]
    audit_logs = [e for e in added_entities if isinstance(e, ComplianceImmutableAuditLog)]
    assert len(audit_logs) == 1
    audit = audit_logs[0]
    assert audit.event_type == "CUSTOMER_MERGE"
    assert audit.entity_name == "CUSTOMER"
    assert audit.entity_id == target_cust.id
    assert audit.worm_locked is True
    assert audit.retention_policy == "STATUTORY_7_YEARS"
    assert audit.payload_hash is not None

    # 10. Atomicity
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_rest_api_merge_customers_endpoint():
    """Verify the mounted POST /customers/merge endpoint delegates to CrmService."""
    mock_db = AsyncMock()
    mock_tenant = TenantContext(company_id="COMP-001", branch_id="MAIN")
    mock_user = User(id="user-admin-1", role=UserRole.SYSADMIN)

    payload = CustomerMergeRequest(
        targetCustomerId="cust-t-1",
        sourceCustomerId="cust-s-2",
        reason="Operational merger",
    )

    expected_resp = CustomerMergeResponse(
        targetCustomerId="cust-t-1",
        sourceCustomerId="cust-s-2",
        status="merged",
        message="Consolidated",
        reassignedRecords={"sales_invoices": 3},
    )

    with patch.object(CrmService, "merge_customer", new_callable=AsyncMock) as mock_merge:
        mock_merge.return_value = expected_resp

        result = await merge_customers(
            payload=payload,
            db=mock_db,
            tenant_ctx=mock_tenant,
            current_user=mock_user,
        )

        mock_merge.assert_awaited_once_with(
            target_id="cust-t-1",
            source_id="cust-s-2",
            reason="Operational merger",
            actor_user_id="user-admin-1",
            actor_role="SYSADMIN",
        )
        assert result.status == "merged"
        assert result.target_customer_id == "cust-t-1"
