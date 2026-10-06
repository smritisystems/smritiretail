"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — API v1 Controller
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CORE_FOUNDATION", role="ADAPTER", canonicalOwner="backend/app/services/databridge/service.py")

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import (
    get_company_db,
    get_current_user,
    get_tenant_context,
    require_permission,
    TenantContext,
)
from ...models.auth import User
from ...models.capability_template import TenantCapabilityBinding
from ...services.databridge.service import DataBridgeService
from ...services.databridge.async_engine import DataBridgeAsyncEngine
from ...services.databridge.export_engine import DataBridgeExportEngine
from ...services.databridge.migration_engine import DataBridgeMigrationToolkit
from ...services.databridge.schema_mapping_engine import DataBridgeSchemaMapper
from ...services.databridge.connectors import DataBridgeConnectorOrchestrator
from ...services.databridge.exceptions import (
    DataBridgeEntitlementError,
    DataBridgeTenantIsolationError,
    DataBridgePermissionError,
    DataBridgeValidationError,
    DataBridgePayloadTooLargeError,
    DataBridgeCommitConfirmationError,
    DataBridgeStalePreviewError,
    DataBridgeAtomicRollbackError,
    DataBridgeError,
)
from ...services.databridge.models import (
    DataBridgeStatusResponse,
    DataBridgeContractPingRequest,
    DataBridgeContractPingResponse,
    DataBridgePreviewRequest,
    DataBridgePreviewResponse,
    DataBridgeCommitRequest,
    DataBridgeCommitResponse,
    DataBridgeEntityType,
    DataBridgeAsyncSubmitRequest,
    DataBridgeAsyncJobResponse,
    DataBridgeJobStatusResponse,
    DataBridgeExportFormat,
    DataBridgeExportRequest,
    DataBridgeExportResponse,
    DataBridgeRollbackRequest,
    DataBridgeRollbackResponse,
    DataBridgeTenantTransferRequest,
    DataBridgeTenantTransferResponse,
    DataBridgeSchemaDetectRequest,
    DataBridgeSchemaDetectResponse,
    DataBridgeConnectorDescriptor,
    DataBridgeConnectorTestRequest,
    DataBridgeConnectorTestResponse,
    DataBridgeConnectorPullRequest,
    DataBridgeConnectorPullResponse,
    DataBridgeConnectorPushRequest,
    DataBridgeConnectorPushResponse,
)


router = APIRouter()


async def require_databridge_entitlement(
    company_db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
) -> TenantCapabilityBinding:
    """
    Enforces that the DATABRIDGE capability is activated in the tenant's company database.
    If disabled or not bound, raises HTTP 403 Forbidden with HREP error SMRITI-CAP-001.
    """
    try:
        return await DataBridgeService.verify_capability_entitlement(
            company_db=company_db,
            company_id=tenant.company_id,
            capability_code="DATABRIDGE",
        )
    except DataBridgeEntitlementError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=exc.message,
        ) from exc
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        ) from exc


@router.get(
    "/status",
    response_model=DataBridgeStatusResponse,
    summary="Get SMRITI DataBridge operational status",
    tags=["SMRITI DataBridge"],
)
async def get_databridge_status(
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeStatusResponse:
    """
    Returns live operational status of SMRITI DataBridge for the authenticated tenant.
    Enforces the canonical 7-stage security chain:
    AUTH -> TenantContext -> capability entitlement -> RBAC -> company DB resolution -> business op -> audit.
    """
    try:
        return await DataBridgeService.get_status(
            company_db=company_db,
            tenant_id=tenant.tenant_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            is_entitled=True,
        )
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        ) from exc


@router.post(
    "/contract/ping",
    response_model=DataBridgeContractPingResponse,
    summary="Execute SMRITI DataBridge contract handshake ping",
    tags=["SMRITI DataBridge"],
)
async def execute_databridge_contract_ping(
    req: DataBridgeContractPingRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeContractPingResponse:
    """
    Executes a governed handshake verification, writes a cryptographic WORM audit record,
    and validates the complete end-to-end multi-tenant isolation invariant.
    """
    actor_id = getattr(current_user, "username", None) or getattr(current_user, "id", "usr-unknown")
    actor_role = getattr(current_user, "role", "USER")
    if hasattr(actor_role, "value"):
        actor_role = actor_role.value

    try:
        response = await DataBridgeService.execute_contract_ping(
            company_db=company_db,
            tenant_id=tenant.tenant_id,
            company_id=tenant.company_id,
            actor_id=str(actor_id),
            actor_role=str(actor_role),
            req=req,
        )
        await company_db.commit()
        return response
    except DataBridgeTenantIsolationError as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        ) from exc
    except Exception as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMRITI-DBRIDGE-002: Handshake verification error: {str(exc)}",
        ) from exc


# ==============================================================================
# PHASE 2 CATALOG PREVIEW & COMMIT CONTROLLERS
# ==============================================================================

async def _handle_preview(
    req: DataBridgePreviewRequest,
    current_user: User,
    tenant: TenantContext,
    company_db: AsyncSession,
) -> DataBridgePreviewResponse:
    actor_id = getattr(current_user, "username", None) or getattr(current_user, "id", "usr-unknown")
    actor_role = getattr(current_user, "role", "USER")
    if hasattr(actor_role, "value"):
        actor_role = actor_role.value

    try:
        return await DataBridgeService.execute_preview(
            company_db=company_db,
            tenant_id=tenant.tenant_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            actor_id=str(actor_id),
            actor_role=str(actor_role),
            req=req,
        )
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        ) from exc
    except DataBridgePayloadTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=exc.message,
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMRITI-DBRIDGE-003: Preview processing error: {str(exc)}",
        ) from exc


async def _handle_commit(
    req: DataBridgeCommitRequest,
    current_user: User,
    tenant: TenantContext,
    company_db: AsyncSession,
) -> DataBridgeCommitResponse:
    actor_id = getattr(current_user, "username", None) or getattr(current_user, "id", "usr-unknown")
    actor_role = getattr(current_user, "role", "USER")
    if hasattr(actor_role, "value"):
        actor_role = actor_role.value

    try:
        response = await DataBridgeService.execute_commit(
            company_db=company_db,
            tenant_id=tenant.tenant_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            actor_id=str(actor_id),
            actor_role=str(actor_role),
            req=req,
        )
        await company_db.commit()
        return response
    except DataBridgeTenantIsolationError as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        ) from exc
    except DataBridgeCommitConfirmationError as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc
    except DataBridgeStalePreviewError as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        ) from exc
    except (DataBridgeAtomicRollbackError, DataBridgeValidationError) as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from exc
    except DataBridgePayloadTooLargeError as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=exc.message,
        ) from exc
    except Exception as exc:
        await company_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMRITI-DBRIDGE-004: Commit execution error: {str(exc)}",
        ) from exc


# ── Generic Document Preview & Commit ──────────────────────────────────────────

@router.post(
    "/preview",
    response_model=DataBridgePreviewResponse,
    summary="Preview and validate catalog ingress payload",
    tags=["SMRITI DataBridge"],
)
async def preview_databridge_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    """Executes read-only candidate matching, diff generation, and conflict classification."""
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post(
    "/commit",
    response_model=DataBridgeCommitResponse,
    summary="Atomically commit confirmed catalog ingress payload",
    tags=["SMRITI DataBridge"],
)
async def commit_databridge_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    """Atomically commits catalog changes delegating to canonical domain services."""
    return await _handle_commit(req, current_user, tenant, company_db)


# ── Entity-Specific Convenience Routes ────────────────────────────────────────

@router.post("/item/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_item_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.ITEM
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/item/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_item_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.ITEM
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/variant/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_variant_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.VARIANT
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/variant/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_variant_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.VARIANT
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/barcode/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_barcode_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.BARCODE
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/barcode/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_barcode_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.BARCODE
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/pricebook/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_pricebook_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.PRICEBOOK
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/pricebook/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_pricebook_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.PRICEBOOK
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/customer/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_customer_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.CUSTOMER
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/customer/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_customer_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.CUSTOMER
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/supplier/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_supplier_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.SUPPLIER
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/supplier/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_supplier_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.SUPPLIER
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/purchase-order/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_purchase_order_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.PURCHASE_ORDER
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/purchase-order/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_purchase_order_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.PURCHASE_ORDER
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/grn/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_grn_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.GOODS_RECEIPT_NOTE
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/grn/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_grn_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.GOODS_RECEIPT_NOTE
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/purchase-invoice/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_purchase_invoice_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.PURCHASE_INVOICE
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/purchase-invoice/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_purchase_invoice_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.PURCHASE_INVOICE
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/purchase-debit-note/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_purchase_debit_note_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.PURCHASE_DEBIT_NOTE
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/purchase-debit-note/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_purchase_debit_note_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.PURCHASE_DEBIT_NOTE
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/sales-invoice/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_sales_invoice_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.SALES_INVOICE
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/sales-invoice/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_sales_invoice_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.SALES_INVOICE
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/sales-order/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_sales_order_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.SALES_ORDER
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/sales-order/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_sales_order_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.SALES_ORDER
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/sales-return/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_sales_return_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.SALES_RETURN
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/sales-return/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_sales_return_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.SALES_RETURN
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/stock-transfer/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_stock_transfer_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.STOCK_TRANSFER
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/stock-transfer/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_stock_transfer_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.STOCK_TRANSFER
    return await _handle_commit(req, current_user, tenant, company_db)


@router.post("/stock-audit/preview", response_model=DataBridgePreviewResponse, tags=["SMRITI DataBridge"])
async def preview_stock_audit_payload(
    req: DataBridgePreviewRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgePreviewResponse:
    req.entity_type = DataBridgeEntityType.STOCK_AUDIT
    return await _handle_preview(req, current_user, tenant, company_db)


@router.post("/stock-audit/commit", response_model=DataBridgeCommitResponse, tags=["SMRITI DataBridge"])
async def commit_stock_audit_payload(
    req: DataBridgeCommitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeCommitResponse:
    req.entity_type = DataBridgeEntityType.STOCK_AUDIT
    return await _handle_commit(req, current_user, tenant, company_db)


# ==============================================================================
# PHASE 4 ASYNCHRONOUS IMPORT ENGINE & CHUNKED QUEUE ENDPOINTS
# ==============================================================================

@router.post("/async/submit", response_model=DataBridgeAsyncJobResponse, status_code=status.HTTP_202_ACCEPTED, tags=["SMRITI DataBridge"])
async def submit_async_import_job(
    req: DataBridgeAsyncSubmitRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeAsyncJobResponse:
    """
    Submits a high-volume dataset (>5,000 rows) to the transactional outbox queue.
    Returns HTTP 202 Accepted with a unique job_id for background progress polling.
    """
    try:
        return await DataBridgeAsyncEngine.submit_job(
            company_db=company_db,
            tenant_id=tenant.tenant_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            actor_id=current_user.id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            req=req,
        )
    except DataBridgeValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from exc
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=exc.message,
        ) from exc
    except DataBridgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc


@router.get("/async/status/{job_id}", response_model=DataBridgeJobStatusResponse, tags=["SMRITI DataBridge"])
async def get_async_import_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeJobStatusResponse:
    """
    Retrieves real-time progress metrics and current lifecycle status for an async job.
    """
    try:
        return await DataBridgeAsyncEngine.get_job_status(
            company_db=company_db,
            company_id=tenant.company_id,
            job_id=job_id,
        )
    except DataBridgeValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.message,
        ) from exc
    except DataBridgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc


@router.post("/async/process-next", response_model=Optional[DataBridgeJobStatusResponse], tags=["SMRITI DataBridge"])
async def process_next_async_job(
    job_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> Optional[DataBridgeJobStatusResponse]:
    """
    Pumps and executes chunks from the oldest eligible job in the tenant's outbox queue.
    """
    try:
        return await DataBridgeAsyncEngine.process_next_job(
            company_db=company_db,
            company_id=tenant.company_id,
            job_id=job_id,
        )
    except DataBridgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc


@router.post("/async/cancel/{job_id}", response_model=DataBridgeJobStatusResponse, tags=["SMRITI DataBridge"])
async def cancel_async_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeJobStatusResponse:
    """
    Cancels an active or pending async import job in the tenant's outbox queue.
    """
    try:
        return await DataBridgeAsyncEngine.cancel_job(
            company_db=company_db,
            company_id=tenant.company_id,
            job_id=job_id,
        )
    except DataBridgeValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc
    except DataBridgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc


# ==============================================================================
# PHASE 5 MULTI-FORMAT STREAMING EXPORT ENDPOINTS
# ==============================================================================

@router.get("/export/{entity_type}", tags=["SMRITI DataBridge"])
async def export_entity_stream_get(
    entity_type: DataBridgeEntityType,
    format: DataBridgeExportFormat = Query(default=DataBridgeExportFormat.CSV),
    limit: int = Query(default=50000, ge=1, le=100000),
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> Response:
    """
    Streams exported records for any supported entity domain in CSV, JSON, SMRITI-X, or XLSX format.
    """
    try:
        req = DataBridgeExportRequest(
            entity_type=entity_type,
            file_format=format,
            limit=limit,
        )
        content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
            company_db=company_db,
            company_id=tenant.company_id,
            actor_id=current_user.id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            req=req,
        )
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-SMRITI-Checksum-SHA256": sha256_hash,
            "X-SMRITI-Entity-Type": entity_type.value,
        }
        return Response(content=content_bytes, media_type=media_type, headers=headers)
    except DataBridgeValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc
    except DataBridgeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc


@router.post("/export", tags=["SMRITI DataBridge"])
async def export_entity_dataset_post(
    req: DataBridgeExportRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
    company_db: AsyncSession = Depends(get_company_db),
) -> Response:
    """
    Configured POST export generating streamed CSV, JSON, SMRITI-X, or XLSX binary data.
    """
    try:
        content_bytes, media_type, filename, sha256_hash = await DataBridgeExportEngine.export_dataset(
            company_db=company_db,
            company_id=tenant.company_id,
            actor_id=current_user.id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            req=req,
        )
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-SMRITI-Checksum-SHA256": sha256_hash,
            "X-SMRITI-Entity-Type": req.entity_type.value,
        }
        return Response(content=content_bytes, media_type=media_type, headers=headers)
    except DataBridgeValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc
    except DataBridgeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc


# ==============================================================================
# PHASE 6 MIGRATION TOOLKIT & ROLLBACK ENDPOINTS
# ==============================================================================

@router.post("/rollback", response_model=DataBridgeRollbackResponse, tags=["SMRITI DataBridge"])
async def rollback_import_batch_endpoint(
    req: DataBridgeRollbackRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeRollbackResponse:
    """
    Executes a deterministic rollback of newly created records for a batch or job.
    Soft-deletes records adhering to the Statutory Immutability Doctrine and records chained WORM audit logs.
    """
    try:
        actor_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        return await DataBridgeMigrationToolkit.execute_rollback(
            company_db=company_db,
            company_id=tenant.company_id,
            actor_id=current_user.id,
            actor_role=actor_role,
            req=req,
        )
    except DataBridgePermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc
    except DataBridgeValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc
    except DataBridgeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc


@router.post("/sync/tenant-transfer", response_model=DataBridgeTenantTransferResponse, tags=["SMRITI DataBridge"])
async def replicate_tenant_dataset_endpoint(
    req: DataBridgeTenantTransferRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "EXECUTE")),
    company_db: AsyncSession = Depends(get_company_db),
) -> DataBridgeTenantTransferResponse:
    """
    Replicates data between tenant company databases using canonical SMRITI-X envelopes.
    Supports preview-only validation or direct atomic commit.
    """
    try:
        actor_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        return await DataBridgeMigrationToolkit.execute_tenant_transfer(
            source_db=company_db,
            target_db=company_db,
            actor_id=current_user.id,
            actor_role=actor_role,
            req=req,
        )
    except DataBridgePermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc
    except DataBridgeValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except DataBridgeTenantIsolationError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc
    except DataBridgeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc


# ==============================================================================
# PHASE 7 SCHEMA MAPPING INTELLIGENCE ENDPOINTS
# ==============================================================================

@router.post("/schema/detect", response_model=DataBridgeSchemaDetectResponse, tags=["SMRITI DataBridge"])
async def detect_schema_mapping_endpoint(
    req: DataBridgeSchemaDetectRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
) -> DataBridgeSchemaDetectResponse:
    """
    Analyzes raw spreadsheet column headers and optional sample rows.
    Returns recommended field mappings, confidence scores, ambiguity flags, and missing required field reports.
    """
    return DataBridgeSchemaMapper.detect_schema(req)


# ==============================================================================
# PHASE 8 THIRD-PARTY CONNECTOR FRAMEWORK ENDPOINTS
# ==============================================================================

@router.get("/connectors", response_model=List[DataBridgeConnectorDescriptor], tags=["SMRITI DataBridge"])
async def list_connectors_endpoint(
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
) -> List[DataBridgeConnectorDescriptor]:
    """
    Lists all available external enterprise connectors, supported entity domains, and configuration schemas.
    """
    return DataBridgeConnectorOrchestrator.list_connectors()


@router.post("/connectors/test", response_model=DataBridgeConnectorTestResponse, tags=["SMRITI DataBridge"])
async def test_connector_endpoint(
    req: DataBridgeConnectorTestRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "READ")),
) -> DataBridgeConnectorTestResponse:
    """
    Tests connectivity and validates credentials for a specific external connector.
    """
    try:
        return await DataBridgeConnectorOrchestrator.test_connection(req)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/connectors/pull", response_model=DataBridgeConnectorPullResponse, tags=["SMRITI DataBridge"])
async def pull_connector_endpoint(
    req: DataBridgeConnectorPullRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "WRITE")),
) -> DataBridgeConnectorPullResponse:
    """
    Pulls raw external records from connector (or parses provided payload)
    and transforms them into canonical SMRITI DataBridge tabular rows ready for preview or ingestion.
    """
    try:
        return await DataBridgeConnectorOrchestrator.pull_and_transform(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Connector pull failed: {str(exc)}") from exc


@router.post("/connectors/push", response_model=DataBridgeConnectorPushResponse, tags=["SMRITI DataBridge"])
async def push_connector_endpoint(
    req: DataBridgeConnectorPushRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
    _entitlement: TenantCapabilityBinding = Depends(require_databridge_entitlement),
    _rbac: User = Depends(require_permission("databridge", "WRITE")),
) -> DataBridgeConnectorPushResponse:
    """
    Formats canonical SMRITI records into external vendor formats (e.g. TallyPrime XML, SAP B1 OData)
    and dispatches outward synchronization payloads.
    """
    try:
        return await DataBridgeConnectorOrchestrator.push_records(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Connector push failed: {str(exc)}") from exc







