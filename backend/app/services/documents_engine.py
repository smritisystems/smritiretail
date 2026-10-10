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
import json
import hashlib
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_, func, case
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.numbering import DocumentSeries, NumberingAuditLog


class RangeExhaustedError(HTTPException):
    """
    Statutory & Governance Error: Raised when a document numbering series reaches its end_number ceiling.
    Strictly prevents number spillover or silent category overflow.
    """
    def __init__(
        self,
        series_name: str,
        category: Optional[str],
        start_number: int,
        end_number: int,
        next_number: int,
    ):
        cat_suffix = f" for category '{category}'" if category else ""
        detail = (
            f"Article numbering range exhausted{cat_suffix}. "
            f"Configured range: {start_number}-{end_number}. "
            f"Next number: {next_number}. "
            f"Please configure a new Article numbering series."
        )
        super().__init__(status_code=409, detail=detail)
from ..models.tax_inv_template import TaxInvoiceTemplate, TaxInvoiceTemplateVersion, InvoiceDocumentArtifact
from ..schemas.documents import (
    DocumentSeriesCreateRequest,
    DocumentSeriesResponse,
    SequenceAllocateRequest,
    SequenceAllocateResponse,
    DocumentTemplateCreateRequest,
    DocumentTemplateResponse,
    DocumentRenderRequest,
    DocumentRenderResponse,
    DocumentPrintJobRequest,
    DocumentPrintJobResponse,
    DocumentLifecycleUpdateRequest,
    DocumentLifecycleStatusResponse,
)


LIFECYCLE_TRANSITION_GRAPH = {
    "DRAFT": ["ISSUED", "CANCELLED", "VOIDED"],
    "ISSUED": ["PRINTED", "AMENDED", "CANCELLED", "VOIDED"],
    "PRINTED": ["AMENDED", "CANCELLED", "VOIDED", "PRINTED"],  # PRINTED -> PRINTED allows reprinting
    "AMENDED": ["ISSUED", "PRINTED", "CANCELLED", "VOIDED"],
    "CANCELLED": [],
    "VOIDED": [],
}


class DocumentsEngine:
    """
    Authoritative SMRITI Documents Engine (Section 7).
    Governs document numbering series, locked gapless allocations, versioned layout templates,
    immutable artifact rendering with SHA256 integrity, print dispatch, and lifecycle state machines.
    """

    @classmethod
    async def create_document_series(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DocumentSeriesCreateRequest,
        created_by: Optional[str] = None,
    ) -> DocumentSeries:
        """Creates a new document numbering series configuration."""
        stmt = select(DocumentSeries).where(
            DocumentSeries.company_id == company_id,
            DocumentSeries.document_type == req.document_type.upper(),
            DocumentSeries.name == req.name,
            DocumentSeries.is_deleted == False
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            raise ValueError(f"Document series '{req.name}' for type '{req.document_type}' already exists.")

        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name=req.name,
            document_type=req.document_type.upper(),
            module=req.module,
            prefix=req.prefix,
            suffix=req.suffix,
            running_length=req.running_length,
            reset_rule=req.reset_rule,
            current_number=0,
            start_number=getattr(req, "start_number", 1) or 1,
            end_number=getattr(req, "end_number", None),
            category=req.category.strip().upper() if getattr(req, "category", None) else None,
            financial_year=req.financial_year or "2026-2027",
            company_code=req.company_code or "COMP-001",
            mode=req.mode,
            description=req.description,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()
        return series

    @classmethod
    async def allocate_next_number_in_transaction(
        cls,
        session: AsyncSession,
        company_id: str,
        document_type: str,
        branch_id: Optional[str] = None,
        financial_year: Optional[str] = None,
        company_code: Optional[str] = None,
        created_by: Optional[str] = None,
        category: Optional[str] = None,
    ) -> SequenceAllocateResponse:
        """
        Allocate next sequential document number using row-level locking (with_for_update)
        without committing the caller's transaction. Supports category-aware series resolution,
        start_number compliance, and strict range ceiling enforcement with zero spillover.
        """
        doc_type = document_type.upper()
        normalized_category = category.strip().upper() if category and str(category).strip() else None

        base_filters = [
            DocumentSeries.company_id == company_id,
            DocumentSeries.document_type == doc_type,
            DocumentSeries.is_deleted == False,
            DocumentSeries.is_active == True,
        ]

        series = None

        # 1. When category is supplied: FIRST search for document_type = doc_type and category = normalized_category
        if normalized_category:
            cat_filters = list(base_filters)
            cat_filters.append(func.upper(DocumentSeries.category) == normalized_category)
            if branch_id is not None:
                cat_filters.append(
                    or_(
                        DocumentSeries.branch_id == branch_id,
                        DocumentSeries.branch_id.is_(None),
                    )
                )

            cat_stmt = (
                select(DocumentSeries)
                .where(*cat_filters)
                .order_by(
                    case((DocumentSeries.branch_id == branch_id, 0), else_=1) if branch_id else DocumentSeries.id,
                    DocumentSeries.created_at.asc(),
                    DocumentSeries.id.asc(),
                )
                .with_for_update()
            )
            cat_candidates = (await session.execute(cat_stmt)).scalars().all()
            if cat_candidates:
                top_branch = cat_candidates[0].branch_id
                same_scope = [s for s in cat_candidates if s.branch_id == top_branch]
                if len(same_scope) > 1:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Ambiguous document series configuration: Multiple active series found for "
                            f"document type '{doc_type}' and category '{normalized_category}'. "
                            f"Please maintain exactly one active series per category scope."
                        )
                    )
                series = cat_candidates[0]

        # 2. Fallback: if no category-specific series exists, allow fallback to category IS NULL
        if not series:
            fallback_filters = list(base_filters)
            fallback_filters.append(DocumentSeries.category.is_(None))
            if branch_id is not None:
                fallback_filters.append(
                    or_(
                        DocumentSeries.branch_id == branch_id,
                        DocumentSeries.branch_id.is_(None),
                    )
                )

            fallback_stmt = (
                select(DocumentSeries)
                .where(*fallback_filters)
                .order_by(
                    case((DocumentSeries.branch_id == branch_id, 0), else_=1) if branch_id else DocumentSeries.id,
                    DocumentSeries.created_at.asc(),
                    DocumentSeries.id.asc(),
                )
                .with_for_update()
            )
            fallback_candidates = (await session.execute(fallback_stmt)).scalars().all()
            if fallback_candidates:
                top_branch = fallback_candidates[0].branch_id
                same_scope_fallback = [s for s in fallback_candidates if s.branch_id == top_branch]
                if len(same_scope_fallback) > 1:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Ambiguous document series configuration: Multiple active fallback (category IS NULL) "
                            f"series found for document type '{doc_type}'. "
                            f"Please maintain exactly one active fallback series."
                        )
                    )
                series = fallback_candidates[0]

        # 3. Dynamic Provisioning or Fail
        if not series:
            if doc_type == "ARTICLE":
                cat_desc = f"category '{normalized_category}'" if normalized_category else "default scope"
                raise HTTPException(
                    status_code=400,
                    detail=f"Article numbering series is not configured for {cat_desc} and no active fallback series exists."
                )

            prefixes = {
                "SALES_INVOICE": "INV-",
                "POS_BILL": "POS-",
                "GOODS_RECEIPT_NOTE": "GRN-",
                "DELIVERY_CHALLAN": "DC-",
                "PURCHASE_ORDER": "PO-",
                "CREDIT_NOTE": "CN-",
                "DEBIT_NOTE": "DN-",
                "PAYMENT_RECEIPT": "RCP-",
            }
            def_prefix = prefixes.get(doc_type, f"{doc_type[:3]}-")
            running_len = 4
            if doc_type == "SALES_INVOICE" and str(company_id).upper() in ("COMP-001", "SMRITI001", "001"):
                fy_str = financial_year or "2026-2027"
                def_prefix = f"TT{fy_str}/"
                running_len = 1
            series = DocumentSeries(
                id=f"ser_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                name=f"Default {doc_type} Series",
                document_type=doc_type,
                module="CORE",
                prefix=def_prefix,
                suffix="",
                running_length=running_len,
                reset_rule="Financial Year",
                current_number=0,
                start_number=1,
                end_number=None,
                category=normalized_category,
                financial_year=financial_year or "2026-2027",
                company_code=company_code or company_id,
                mode="Auto",
                created_by=created_by,
                is_active=True,
                is_deleted=False,
            )
            session.add(series)
            await session.flush()

        # Reconcile invoice numbering if SALES_INVOICE
        if doc_type == "SALES_INVOICE":
            from ..models.sales import SalesInvoice

            invoice_filters = [
                SalesInvoice.company_id == company_id,
                SalesInvoice.is_deleted == False,
            ]
            existing_numbers = (await session.execute(
                select(SalesInvoice.invoice_no).where(*invoice_filters)
            )).scalars().all()
            series_prefix = series.prefix or ""
            highest_existing = 0
            for existing_no in existing_numbers:
                if not existing_no or not str(existing_no).startswith(series_prefix):
                    continue
                numeric_suffix = str(existing_no)[len(series_prefix):].lstrip("-/")
                if numeric_suffix.isdigit():
                    highest_existing = max(highest_existing, int(numeric_suffix))
            if highest_existing > (series.current_number or 0):
                series.current_number = highest_existing

        # 4. Start Number must be honoured
        start_num = series.start_number or 1
        old_num = series.current_number

        if old_num is None or old_num < start_num - 1:
            new_num = start_num
        else:
            new_num = old_num + 1

        # 5. Range Enforcement (Strict No-Spillover)
        if series.end_number is not None and new_num > series.end_number:
            cat_label = series.category or normalized_category
            raise RangeExhaustedError(
                series_name=series.name,
                category=cat_label,
                start_number=start_num,
                end_number=series.end_number,
                next_number=new_num,
            )

        series.current_number = new_num
        padded_seq = str(new_num).zfill(series.running_length or 4)
        doc_no = f"{series.prefix or ''}{padded_seq}{series.suffix or ''}"

        session.add(NumberingAuditLog(
            id=f"nal_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            series_id=series.id,
            series_name=series.name,
            action="ALLOCATE",
            document_no=doc_no,
            old_value=str(old_num if old_num is not None else 0),
            new_value=str(new_num),
            details=f"Allocated sequential number {new_num} for document type {doc_type}" + (f" and category {normalized_category}" if normalized_category else ""),
            operator=created_by or "system",
            is_active=True,
            is_deleted=False,
        ))
        return SequenceAllocateResponse(
            series_id=series.id,
            document_type=doc_type,
            allocated_number=new_num,
            document_no=doc_no,
            allocated_at=datetime.now(timezone.utc),
        )

    @classmethod
    async def allocate_next_number(
        cls,
        session: AsyncSession,
        company_id: str,
        req: SequenceAllocateRequest,
        created_by: Optional[str] = None,
    ) -> SequenceAllocateResponse:
        """
        Allocates next sequential document number using row-level locking (with_for_update)
        guaranteeing strict gapless continuity, category range enforcement, and statutory compliance.
        """
        resp = await cls.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type=req.document_type,
            branch_id=getattr(req, "branch_id", None),
            financial_year=getattr(req, "financial_year", None),
            company_code=getattr(req, "company_code", None),
            created_by=created_by,
            category=getattr(req, "category", None),
        )
        await session.commit()
        return resp

    @classmethod
    async def preview_next_number(
        cls,
        session: AsyncSession,
        company_id: str,
        document_type: str,
        category: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Authoritative read-only preview of next sequential document number.
        Zero database mutations, zero counter consumption, zero row locks.
        Follows exact series resolution hierarchy:
        1. Exact category match
        2. Fallback to category IS NULL
        """
        doc_type = document_type.upper()
        normalized_category = category.strip().upper() if category and str(category).strip() else None

        base_filters = [
            DocumentSeries.company_id == company_id,
            DocumentSeries.document_type == doc_type,
            DocumentSeries.is_deleted == False,
            DocumentSeries.is_active == True,
        ]

        series = None

        # 1. Exact category match first
        if normalized_category:
            cat_filters = list(base_filters)
            cat_filters.append(func.upper(DocumentSeries.category) == normalized_category)
            if branch_id is not None:
                cat_filters.append(or_(DocumentSeries.branch_id == branch_id, DocumentSeries.branch_id.is_(None)))
            stmt = select(DocumentSeries).where(*cat_filters).order_by(DocumentSeries.created_at.asc(), DocumentSeries.id.asc())
            candidates = (await session.execute(stmt)).scalars().all()
            if candidates:
                series = candidates[0]

        # 2. Fallback to category IS NULL
        if not series:
            fallback_filters = list(base_filters)
            fallback_filters.append(DocumentSeries.category.is_(None))
            if branch_id is not None:
                fallback_filters.append(or_(DocumentSeries.branch_id == branch_id, DocumentSeries.branch_id.is_(None)))
            stmt = select(DocumentSeries).where(*fallback_filters).order_by(DocumentSeries.created_at.asc(), DocumentSeries.id.asc())
            candidates = (await session.execute(stmt)).scalars().all()
            if candidates:
                series = candidates[0]

        if not series:
            cat_desc = f"category '{normalized_category}'" if normalized_category else "default scope"
            return {
                "success": False,
                "is_configured": False,
                "isConfigured": False,
                "series_id": None,
                "seriesId": None,
                "series_name": None,
                "seriesName": None,
                "document_no": None,
                "documentNo": None,
                "formattedPreview": None,
                "message": f"Article numbering series is not configured for {cat_desc} and no active fallback series exists.",
            }

        start_num = series.start_number or 1
        old_num = series.current_number

        if old_num is None or old_num < start_num - 1:
            new_num = start_num
        else:
            new_num = old_num + 1

        is_exhausted = bool(series.end_number is not None and new_num > series.end_number)

        padded = str(new_num).zfill(series.running_length)
        prefix = series.prefix or ""
        suffix = series.suffix or ""
        num_format = getattr(series, "number_format", None) or "PREFIX_NUM_SUFFIX"

        if is_exhausted:
            formatted = f"EXHAUSTED (Range {start_num}-{series.end_number})"
        elif num_format == "PREFIX_NUM_SUFFIX":
            formatted = f"{prefix}{padded}{suffix}"
        elif num_format == "PREFIX_YEAR_SEP_NUM":
            raw_fy = series.financial_year or "26-27"
            fy = f"{raw_fy[2:4]}-{raw_fy[7:9]}" if "-" in raw_fy and len(raw_fy) == 9 else raw_fy
            formatted = f"{prefix}{fy}/{padded}"
        elif num_format == "PREFIX_SEP_NUM":
            formatted = f"{prefix}/{padded}"
        elif num_format == "NUM_ONLY":
            formatted = f"{padded}"
        else:
            formatted = f"{prefix}{padded}{suffix}"

        return {
            "success": True,
            "is_configured": True,
            "isConfigured": True,
            "series_id": series.id,
            "seriesId": series.id,
            "series_name": series.name,
            "seriesName": series.name,
            "category": series.category,
            "prefix": prefix,
            "suffix": suffix,
            "next_number": new_num,
            "nextNumber": new_num,
            "document_no": formatted,
            "documentNo": formatted,
            "formattedPreview": formatted,
            "running_length": series.running_length,
            "runningLength": series.running_length,
            "start_number": start_num,
            "startNumber": start_num,
            "end_number": series.end_number,
            "endNumber": series.end_number,
            "is_exhausted": is_exhausted,
            "isExhausted": is_exhausted,
            "message": None,
        }

    @classmethod
    async def create_template(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DocumentTemplateCreateRequest,
        created_by: Optional[str] = None,
    ) -> DocumentTemplateResponse:
        """Creates a versioned layout configuration template with cryptographic hash."""
        cfg_str = json.dumps(req.layout_configuration, sort_keys=True)
        cfg_hash = hashlib.sha256(cfg_str.encode("utf-8")).hexdigest()

        stmt = select(TaxInvoiceTemplate).where(
            TaxInvoiceTemplate.template_code == req.template_code,
            TaxInvoiceTemplate.is_deleted == False
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            raise ValueError(f"Template code '{req.template_code}' already exists.")

        now_date = req.effective_from or date.today()
        template = TaxInvoiceTemplate(
            id=f"tpl_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            template_code=req.template_code,
            template_name=req.template_name,
            template_type=req.template_type.upper(),
            status="FROZEN",
            current_version="V1",
            effective_from=now_date,
            layout_configuration=req.layout_configuration,
            configuration_hash=cfg_hash,
            is_default=req.is_default,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(template)

        # Initial frozen version
        tpl_ver = TaxInvoiceTemplateVersion(
            id=f"tpv_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            template_id=template.id,
            version="V1",
            status="FROZEN",
            layout_configuration=req.layout_configuration,
            configuration_hash=cfg_hash,
            effective_from=now_date,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(tpl_ver)
        await session.commit()

        return DocumentTemplateResponse(
            id=template.id,
            template_code=template.template_code,
            template_name=template.template_name,
            template_type=template.template_type,
            status=template.status,
            current_version=template.current_version,
            effective_from=template.effective_from,
            layout_configuration=template.layout_configuration,
            configuration_hash=template.configuration_hash,
            is_default=template.is_default,
        )

    @classmethod
    async def render_document(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DocumentRenderRequest,
        created_by: Optional[str] = None,
    ) -> DocumentRenderResponse:
        """
        Renders an HTML/text document representation from template layout and context data,
        calculates SHA256 integrity hash, and persists the immutable document artifact.
        """
        ctx = req.data_context
        seller_name = ctx.get("seller_name", "SMRITI RETAIL")
        buyer_name = ctx.get("buyer_name", "Walk-in Customer")
        line_items = ctx.get("items", [])
        grand_total = ctx.get("grand_total", 0.0)

        # Build clean HTML document output
        rows_html = "".join([
            f"<tr><td>{it.get('name', 'Item')}</td><td>{it.get('quantity', 1)}</td><td>₹{it.get('unit_price', 0.0)}</td><td>₹{it.get('amount', 0.0)}</td></tr>"
            for it in line_items
        ])

        rendered_html = f"""<!DOCTYPE html>
<html>
<head><title>{req.document_type} - {req.document_no}</title>
<style>body {{ font-family: sans-serif; margin: 20px; }} table {{ width: 100%; border-collapse: collapse; }} th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; }}</style>
</head>
<body>
<h1>{req.document_type.replace('_', ' ')}: {req.document_no}</h1>
<p><strong>Seller:</strong> {seller_name} | <strong>Buyer:</strong> {buyer_name}</p>
<table>
<thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
<tbody>{rows_html}</tbody>
</table>
<h2>Total: ₹{grand_total}</h2>
</body>
</html>"""

        content_bytes = rendered_html.encode("utf-8")
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()
        file_size = len(content_bytes)

        now = datetime.now(timezone.utc)
        artifact_id = f"art_{uuid.uuid4().hex[:12]}"

        # Ensure foreign key in sales_invoices is satisfied
        from ..models.sales import SalesInvoice
        stmt_inv = select(SalesInvoice).where(SalesInvoice.id == req.document_id)
        inv = (await session.execute(stmt_inv)).scalars().first()
        if not inv:
            inv = SalesInvoice(
                id=req.document_id,
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                invoice_no=req.document_no,
                date=now.date(),
                grand_total=Decimal(str(grand_total or 0.0)),
                tax_total=Decimal("0.00"),
                status="Issued",
                is_active=True,
                is_deleted=False,
                created_by=created_by,
            )
            session.add(inv)
            await session.flush()

        artifact = InvoiceDocumentArtifact(
            id=artifact_id,
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            invoice_id=req.document_id,
            invoice_no=req.document_no,
            document_type=req.document_type.upper(),
            template_code=req.template_code,
            template_version="V1",
            template_status="FROZEN",
            storage_path=f"artifacts/docs/{req.document_type.lower()}/{req.document_no}.html",
            sha256_hash=sha256_hash,
            file_size=file_size,
            page_count=1,
            generated_at=now,
            is_valid=True,
            reprint_count=0,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(artifact)
        await session.commit()

        return DocumentRenderResponse(
            artifact_id=artifact.id,
            document_id=req.document_id,
            document_no=req.document_no,
            template_code=req.template_code,
            template_version="V1",
            rendered_output=rendered_html,
            sha256_hash=sha256_hash,
            file_size_bytes=file_size,
            generated_at=now,
        )

    @classmethod
    async def dispatch_print_job(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DocumentPrintJobRequest,
        created_by: Optional[str] = None,
    ) -> DocumentPrintJobResponse:
        """
        Dispatches a document print job, increments the reprint counter,
        and applies appropriate legal watermarks.
        """
        stmt = select(InvoiceDocumentArtifact).where(
            InvoiceDocumentArtifact.company_id == company_id,
            or_(
                InvoiceDocumentArtifact.invoice_id == req.document_id,
                InvoiceDocumentArtifact.id == req.document_id
            ),
            InvoiceDocumentArtifact.is_deleted == False
        )
        artifact = (await session.execute(stmt)).scalars().first()

        now = datetime.now(timezone.utc)
        if artifact:
            artifact.reprint_count = (artifact.reprint_count or 0) + 1
            artifact.last_reprinted_at = now
            reprint_cnt = artifact.reprint_count
            is_reprint = reprint_cnt > 1
            await session.commit()
        else:
            reprint_cnt = 1
            is_reprint = False

        if is_reprint:
            watermark = f"DUPLICATE COPY (REPRINT #{reprint_cnt})"
        else:
            watermark = req.copy_type.replace("_", " ").title()

        return DocumentPrintJobResponse(
            print_job_id=f"prn_{uuid.uuid4().hex[:12]}",
            document_id=req.document_id,
            reprint_count=reprint_cnt,
            is_reprint=is_reprint,
            watermark_label=watermark,
            spool_status="DISPATCHED",
            dispatched_at=now,
        )

    @classmethod
    async def update_lifecycle_state(
        cls,
        session: AsyncSession,
        company_id: str,
        current_state: str,
        req: DocumentLifecycleUpdateRequest,
    ) -> DocumentLifecycleStatusResponse:
        """
        Validates state transition against canonical document lifecycle transition graph.
        """
        curr = current_state.upper()
        target = req.target_state.upper()

        allowed_targets = LIFECYCLE_TRANSITION_GRAPH.get(curr, [])
        if target not in allowed_targets:
            raise ValueError(
                f"Invalid document lifecycle transition from '{curr}' to '{target}'. Allowed targets: {allowed_targets}"
            )

        now = datetime.now(timezone.utc)
        return DocumentLifecycleStatusResponse(
            document_type=req.document_type.upper(),
            document_id=req.document_id,
            previous_state=curr,
            current_state=target,
            updated_at=now,
            transition_allowed=True,
        )
