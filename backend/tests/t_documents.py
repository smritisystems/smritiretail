"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.numbering import DocumentSeries, NumberingAuditLog
from app.models.tax_inv_template import TaxInvoiceTemplate, InvoiceDocumentArtifact
from app.services.documents_engine import DocumentsEngine
from app.schemas.documents import (
    DocumentSeriesCreateRequest,
    SequenceAllocateRequest,
    DocumentTemplateCreateRequest,
    DocumentRenderRequest,
    DocumentPrintJobRequest,
    DocumentLifecycleUpdateRequest,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_sequential_gapless_numbering_allocation():
    """Verify atomic locked sequence allocation guarantees strict gapless numbering."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    doc_type = f"CUSTOM_DC_{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create custom series
        series = await DocumentsEngine.create_document_series(
            session=session,
            company_id="COMP-001",
            req=DocumentSeriesCreateRequest(
                name=f"Series {unique_suffix}",
                document_type=doc_type,
                prefix="DC-26-",
                running_length=4,
            ),
            created_by="usr-super",
        )

        # Allocate #1
        alloc1 = await DocumentsEngine.allocate_next_number(
            session=session,
            company_id="COMP-001",
            req=SequenceAllocateRequest(document_type=doc_type),
            created_by="usr-super",
        )
        assert alloc1.allocated_number == 1
        assert alloc1.document_no == "DC-26-0001"

        # Allocate #2
        alloc2 = await DocumentsEngine.allocate_next_number(
            session=session,
            company_id="COMP-001",
            req=SequenceAllocateRequest(document_type=doc_type),
            created_by="usr-super",
        )
        assert alloc2.allocated_number == 2
        assert alloc2.document_no == "DC-26-0002"

        # Verify audit logs
        stmt_audit = select(NumberingAuditLog).where(
            NumberingAuditLog.company_id == "COMP-001",
            NumberingAuditLog.series_id == series.id
        )
        logs = (await session.execute(stmt_audit)).scalars().all()
        assert len(logs) == 2


@pytest.mark.asyncio
async def test_document_template_creation_and_hash_binding():
    """Verify template creation with cryptographic configuration hash."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    tpl_code = f"TPL_{unique_suffix.upper()}"

    async with sessionmaker() as session:
        tpl_res = await DocumentsEngine.create_template(
            session=session,
            company_id="COMP-001",
            req=DocumentTemplateCreateRequest(
                template_code=tpl_code,
                template_name=f"Tax Invoice Template {unique_suffix}",
                template_type="TAX_INVOICE",
                layout_configuration={"header": {"show_logo": True}, "columns": ["item", "qty", "rate", "gst", "total"]},
            ),
            created_by="usr-super",
        )
        assert tpl_res.template_code == tpl_code
        assert tpl_res.current_version == "V1"
        assert tpl_res.status == "FROZEN"
        assert len(tpl_res.configuration_hash) == 64  # SHA256 length


@pytest.mark.asyncio
async def test_document_rendering_and_artifact_integrity():
    """Verify document rendering, SHA256 integrity hashing, and artifact persistence."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    doc_id = f"doc_{unique_suffix}"
    doc_no = f"INV-2026-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        render_req = DocumentRenderRequest(
            template_code="TAX_INVOICE_DEFAULT",
            document_type="TAX_INVOICE",
            document_id=doc_id,
            document_no=doc_no,
            data_context={
                "seller_name": "SMRITI RETAIL MUMBAI",
                "buyer_name": f"Customer {unique_suffix}",
                "items": [
                    {"name": "Silk Shirt", "quantity": 2, "unit_price": 1200.0, "amount": 2400.0},
                ],
                "grand_total": 2400.0,
            },
        )

        render_res = await DocumentsEngine.render_document(session, "COMP-001", render_req, created_by="usr-super")
        assert render_res.document_id == doc_id
        assert render_res.document_no == doc_no
        assert len(render_res.sha256_hash) == 64
        assert "Silk Shirt" in render_res.rendered_output
        assert "2400.0" in render_res.rendered_output


@pytest.mark.asyncio
async def test_print_job_dispatch_and_reprint_watermark():
    """Verify print job execution, reprint counter increments, and duplicate watermark stamping."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    doc_id = f"doc_prn_{unique_suffix}"
    doc_no = f"INV-PRN-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # First render document to create artifact
        await DocumentsEngine.render_document(
            session=session,
            company_id="COMP-001",
            req=DocumentRenderRequest(
                template_code="TAX_INVOICE_DEFAULT",
                document_type="TAX_INVOICE",
                document_id=doc_id,
                document_no=doc_no,
                data_context={"seller_name": "SMRITI", "items": [], "grand_total": 500.0},
            ),
        )

        # 1. First Print Job -> Original Copy
        p1 = await DocumentsEngine.dispatch_print_job(
            session=session,
            company_id="COMP-001",
            req=DocumentPrintJobRequest(
                document_id=doc_id,
                copy_type="ORIGINAL_FOR_RECIPIENT",
            ),
        )
        assert p1.reprint_count == 1
        assert p1.is_reprint == False
        assert p1.watermark_label == "Original For Recipient"

        # 2. Second Print Job (Reprint) -> Duplicate Copy
        p2 = await DocumentsEngine.dispatch_print_job(
            session=session,
            company_id="COMP-001",
            req=DocumentPrintJobRequest(
                document_id=doc_id,
                copy_type="DUPLICATE_FOR_TRANSPORTER",
            ),
        )
        assert p2.reprint_count == 2
        assert p2.is_reprint == True
        assert "DUPLICATE COPY (REPRINT #2)" in p2.watermark_label


@pytest.mark.asyncio
async def test_document_lifecycle_state_machine():
    """Verify document lifecycle state transitions and rejection of illegal transitions."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    doc_id = f"doc_lc_{unique_suffix}"

    async with sessionmaker() as session:
        # 1. DRAFT -> ISSUED (Allowed)
        res1 = await DocumentsEngine.update_lifecycle_state(
            session=session,
            company_id="COMP-001",
            current_state="DRAFT",
            req=DocumentLifecycleUpdateRequest(
                document_type="SALES_INVOICE",
                document_id=doc_id,
                target_state="ISSUED",
            ),
        )
        assert res1.current_state == "ISSUED"

        # 2. ISSUED -> PRINTED (Allowed)
        res2 = await DocumentsEngine.update_lifecycle_state(
            session=session,
            company_id="COMP-001",
            current_state="ISSUED",
            req=DocumentLifecycleUpdateRequest(
                document_type="SALES_INVOICE",
                document_id=doc_id,
                target_state="PRINTED",
            ),
        )
        assert res2.current_state == "PRINTED"

        # 3. CANCELLED -> ISSUED (Illegal -> Must raise ValueError)
        with pytest.raises(ValueError, match="Invalid document lifecycle transition"):
            await DocumentsEngine.update_lifecycle_state(
                session=session,
                company_id="COMP-001",
                current_state="CANCELLED",
                req=DocumentLifecycleUpdateRequest(
                    document_type="SALES_INVOICE",
                    document_id=doc_id,
                    target_state="ISSUED",
                ),
            )


@pytest.mark.asyncio
async def test_api_documents_endpoints():
    """Verify REST API documents endpoints: numbering/allocate, templates, render, print, lifecycle."""
    unique_suffix = uuid.uuid4().hex[:4]
    doc_type = f"API_DOC_{unique_suffix.upper()}"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Allocate number via API
        alloc_res = await client.post(
            "/api/v1/documents/numbering/allocate",
            json={"document_type": doc_type},
            headers=_get_auth_headers(),
        )
        assert alloc_res.status_code == 201
        assert alloc_res.json()["allocated_number"] == 1

        # 2. Create template via API
        tpl_res = await client.post(
            "/api/v1/documents/templates",
            json={
                "template_code": f"TPL_API_{unique_suffix.upper()}",
                "template_name": f"API Template {unique_suffix}",
                "layout_configuration": {"fontSize": 12},
            },
            headers=_get_auth_headers(),
        )
        assert tpl_res.status_code == 201

        # 3. Render document via API
        render_res = await client.post(
            "/api/v1/documents/render",
            json={
                "template_code": f"TPL_API_{unique_suffix.upper()}",
                "document_type": doc_type,
                "document_id": f"doc_{unique_suffix}",
                "document_no": f"DOC-{unique_suffix.upper()}-001",
                "data_context": {"seller_name": "SMRITI API", "grand_total": 100.0},
            },
            headers=_get_auth_headers(),
        )
        assert render_res.status_code == 200
        assert len(render_res.json()["sha256_hash"]) == 64

        # 4. Dispatch print via API
        prn_res = await client.post(
            "/api/v1/documents/print",
            json={
                "document_id": f"doc_{unique_suffix}",
                "document_type": doc_type,
                "copy_type": "ORIGINAL_FOR_RECIPIENT",
            },
            headers=_get_auth_headers(),
        )
        assert prn_res.status_code == 200
        assert prn_res.json()["spool_status"] == "DISPATCHED"

        # 5. Transition lifecycle via API
        lc_res = await client.post(
            "/api/v1/documents/lifecycle?current_state=DRAFT",
            json={
                "document_type": doc_type,
                "document_id": f"doc_{unique_suffix}",
                "target_state": "ISSUED",
            },
            headers=_get_auth_headers(),
        )
        assert lc_res.status_code == 200
        assert lc_res.json()["current_state"] == "ISSUED"
