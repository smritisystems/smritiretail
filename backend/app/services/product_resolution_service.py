"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-10-03
Modified     : 2026-10-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Global Product Resolution & Validation Standard (Phase 1, 2, 3, 5, 6, 11)
"""

import logging
import time
import uuid
from decimal import Decimal
from typing import Optional, Dict, Any, List, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from fastapi import HTTPException, status

from ..schemas.product_resolution import (
    ProductResolutionResult,
    ProductResolutionErrorDetail,
    TransactionLineItemInput,
    TransactionValidationResult,
)
from ..core.cohort import CohortEvaluator
from .canonical_telemetry_sink import CanonicalTelemetrySink

logger = logging.getLogger("smriti.product_resolution")


class ProductResolutionService:
    """
    Centralized, Authoritative Product Resolution and Validation Service across SMRITI Retail OS.
    
    Guarantees:
      1. Single Source of Truth for Product Identity across all transactions.
      2. Strict Multi-Tenant Isolation (company_id mandatory for all queries).
      3. Authoritative Identifier Priority: Product ID -> Barcode -> SKU.
      4. Strict Validation: Rejects missing products (PRODUCT_NOT_FOUND),
         inactive products (PRODUCT_INACTIVE), and quarantined items (PRODUCT_QUARANTINED).
      5. Full Bidirectional Parity: Bridges Canonical Item Master (items/variants/barcodes)
         and Legacy Retail Catalog (products) with zero schema drift.
      6. Atomic Batch Validation for multi-line transactions.
    """

    @classmethod
    async def resolve_by_product_id(
        cls,
        session: AsyncSession,
        company_id: str,
        product_id: str,
        allow_inactive: bool = False,
    ) -> ProductResolutionResult:
        """Resolves an authoritative Product by primary product_id (legacy or canonical)."""
        return await cls._resolve_internal(
            session=session,
            company_id=company_id,
            identifier=product_id,
            identifier_type="PRODUCT_ID",
            allow_inactive=allow_inactive,
        )

    @classmethod
    async def resolve_by_barcode(
        cls,
        session: AsyncSession,
        company_id: str,
        barcode: str,
        allow_inactive: bool = False,
    ) -> ProductResolutionResult:
        """Resolves an authoritative Product by exact Barcode."""
        return await cls._resolve_internal(
            session=session,
            company_id=company_id,
            identifier=barcode,
            identifier_type="BARCODE",
            allow_inactive=allow_inactive,
        )

    @classmethod
    async def resolve_by_sku(
        cls,
        session: AsyncSession,
        company_id: str,
        sku: str,
        allow_inactive: bool = False,
    ) -> ProductResolutionResult:
        """Resolves an authoritative Product by Variant SKU or Product Code."""
        return await cls._resolve_internal(
            session=session,
            company_id=company_id,
            identifier=sku,
            identifier_type="SKU",
            allow_inactive=allow_inactive,
        )

    @classmethod
    async def resolve(
        cls,
        session: AsyncSession,
        company_id: str,
        identifier: str,
        identifier_type: Optional[str] = None,
        allow_inactive: bool = False,
    ) -> ProductResolutionResult:
        """
        Universal Resolver respecting Identifier Priority:
        Product ID -> Barcode -> SKU -> Item Code.
        """
        return await cls._resolve_internal(
            session=session,
            company_id=company_id,
            identifier=identifier,
            identifier_type=identifier_type,
            allow_inactive=allow_inactive,
        )

    @classmethod
    async def validate_line(
        cls,
        session: AsyncSession,
        company_id: str,
        line: TransactionLineItemInput,
        allow_inactive: bool = False,
    ) -> ProductResolutionResult:
        """Validates a single transaction line item against authoritative catalog."""
        if line.is_fee_line:
            return ProductResolutionResult(
                success=True,
                name="Service / Non-Inventory Fee",
                is_active=True,
                matched_by="FEE_LINE",
            )

        # Priority 1: Product ID / Variant ID
        if line.product_id and line.product_id.strip():
            res = await cls.resolve_by_product_id(
                session=session,
                company_id=company_id,
                product_id=line.product_id.strip(),
                allow_inactive=allow_inactive,
            )
            if res.success:
                return res

        if line.variant_id and line.variant_id.strip():
            res = await cls.resolve_by_product_id(
                session=session,
                company_id=company_id,
                product_id=line.variant_id.strip(),
                allow_inactive=allow_inactive,
            )
            if res.success:
                return res

        # Priority 2: Barcode
        if line.barcode and line.barcode.strip():
            res = await cls.resolve_by_barcode(
                session=session,
                company_id=company_id,
                barcode=line.barcode.strip(),
                allow_inactive=allow_inactive,
            )
            if res.success:
                return res

        # Priority 3: SKU / Code
        query_code = line.sku or line.code
        if query_code and query_code.strip():
            res = await cls.resolve_by_sku(
                session=session,
                company_id=company_id,
                sku=query_code.strip(),
                allow_inactive=allow_inactive,
            )
            if res.success:
                return res

        # If none resolved, return explicit PRODUCT_NOT_FOUND error
        ident = line.barcode or line.sku or line.code or line.product_id or "UNKNOWN"
        ident_type = (
            "BARCODE" if line.barcode else ("SKU" if (line.sku or line.code) else "PRODUCT_ID")
        )
        return cls._build_not_found_result(ident, ident_type, line_no=line.line_no)

    @classmethod
    async def validate_transaction_lines(
        cls,
        session: AsyncSession,
        company_id: str,
        lines: List[TransactionLineItemInput],
        allow_inactive: bool = False,
    ) -> TransactionValidationResult:
        """
        Atomic Batch Validation for multi-line transactions.
        Validates all lines. If any line is invalid, rejects the transaction with detailed line errors.
        """
        if not company_id or not str(company_id).strip():
            raise ValueError("Multi-tenant security violation: company_id is mandatory")

        resolved_lines: List[ProductResolutionResult] = []
        errors: List[ProductResolutionErrorDetail] = []

        for idx, line in enumerate(lines):
            line.line_no = idx + 1
            res = await cls.validate_line(
                session=session,
                company_id=company_id,
                line=line,
                allow_inactive=allow_inactive,
            )
            resolved_lines.append(res)
            if not res.success and res.error_detail:
                res.error_detail.line_no = line.line_no
                errors.append(res.error_detail)

        is_valid = (len(errors) == 0)
        return TransactionValidationResult(
            is_valid=is_valid,
            total_lines=len(lines),
            valid_lines=len(lines) - len(errors),
            invalid_lines=len(errors),
            errors=errors,
            resolved_lines=resolved_lines,
        )

    @classmethod
    async def enforce_transaction_lines(
        cls,
        session: AsyncSession,
        company_id: str,
        lines: List[TransactionLineItemInput],
        allow_inactive: bool = False,
    ) -> List[ProductResolutionResult]:
        """
        Enforcement gateway: validates lines atomically, raising HTTPException(400)
        if any line fails validation.
        """
        val_result = await cls.validate_transaction_lines(
            session=session,
            company_id=company_id,
            lines=lines,
            allow_inactive=allow_inactive,
        )
        if not val_result.is_valid:
            first_err = val_result.errors[0]
            detail_msg = {
                "code": first_err.code,
                "title": first_err.title,
                "explanation": first_err.explanation,
                "suggested_action": first_err.suggested_action,
                "line_no": first_err.line_no,
                "identifier": first_err.identifier,
                "all_errors": [e.model_dump() for e in val_result.errors],
            }
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail_msg,
            )
        return val_result.resolved_lines

    # -------------------------------------------------------------------------
    # Internal Resolution Implementation
    # -------------------------------------------------------------------------

    @classmethod
    async def _resolve_internal(
        cls,
        session: AsyncSession,
        company_id: str,
        identifier: str,
        identifier_type: Optional[str] = None,
        allow_inactive: bool = False,
    ) -> ProductResolutionResult:
        if not company_id or not str(company_id).strip():
            raise ValueError("Multi-tenant security violation: company_id is mandatory")

        q = str(identifier).strip() if identifier else ""
        if not q:
            return cls._build_not_found_result("", identifier_type or "UNKNOWN")

        t_start = time.perf_counter()

        # Check Cohort Evaluator for Canonical vs Legacy read
        is_canonical = CohortEvaluator.is_canonical_read_enabled(company_id=company_id)

        # Stage 1: Attempt Canonical Resolution
        canonical_row = await cls._query_canonical(session, company_id, q, identifier_type)

        # Stage 2: Attempt Legacy Resolution
        legacy_row = await cls._query_legacy(session, company_id, q, identifier_type)

        res: Optional[ProductResolutionResult] = None

        if canonical_row:
            # Check quarantine status from legacy mapping or item status
            disposition = canonical_row.get("disposition")
            item_status = canonical_row.get("item_status")
            if disposition == "REQUIRES_REVIEW" or item_status == "REQUIRES_REVIEW":
                res = cls._build_quarantined_result(q, identifier_type or "IDENTIFIER")
            else:
                is_active = bool(
                    canonical_row.get("variant_is_active", True)
                    and canonical_row.get("item_is_active", True)
                    and (item_status in (None, "ACTIVE"))
                )
                if not is_active and not allow_inactive:
                    res = cls._build_inactive_result(
                        q,
                        identifier_type or canonical_row.get("matched_by", "IDENTIFIER"),
                        name=canonical_row.get("item_name") or canonical_row.get("variant_name"),
                    )
                else:
                    # Successfully resolved Canonical Product
                    authoritative_product_id = canonical_row.get("legacy_product_id") or canonical_row.get("variant_id")
                    res = ProductResolutionResult(
                        success=True,
                        product_id=str(authoritative_product_id),
                        item_id=str(canonical_row.get("item_id")),
                        variant_id=str(canonical_row.get("variant_id")),
                        sku=canonical_row.get("variant_sku") or canonical_row.get("item_code"),
                        barcode=canonical_row.get("barcode"),
                        name=canonical_row.get("variant_name") or canonical_row.get("item_name"),
                        brand=canonical_row.get("brand"),
                        category=canonical_row.get("category"),
                        category_code=canonical_row.get("category_code"),
                        uom=canonical_row.get("primary_uom") or "NOS",
                        hsn_code=canonical_row.get("hsn_code") or "640411",
                        tax_rate=Decimal(str(canonical_row.get("tax_rate") or "0.00")),
                        mrp=Decimal(str(canonical_row.get("mrp") or "0.00")),
                        selling_price=Decimal(str(canonical_row.get("selling_price") or "0.00")),
                        cost_price=Decimal(str(canonical_row.get("cost_price") or "0.00")),
                        is_active=is_active,
                        is_quarantined=False,
                        resolution_source="CANONICAL_PRIMARY",
                        matched_by=canonical_row.get("matched_by"),
                        product=dict(canonical_row),
                    )

        elif legacy_row:
            # Check quarantine status
            disposition = legacy_row.get("disposition")
            if disposition == "REQUIRES_REVIEW":
                res = cls._build_quarantined_result(q, identifier_type or "IDENTIFIER")
            else:
                is_active = bool(legacy_row.get("is_active", True) and not legacy_row.get("is_deleted", False))
                if not is_active and not allow_inactive:
                    res = cls._build_inactive_result(
                        q,
                        identifier_type or legacy_row.get("matched_by", "IDENTIFIER"),
                        name=legacy_row.get("name"),
                    )
                else:
                    authoritative_product_id = legacy_row.get("id")
                    res = ProductResolutionResult(
                        success=True,
                        product_id=str(authoritative_product_id),
                        item_id=legacy_row.get("canonical_item_id"),
                        variant_id=legacy_row.get("canonical_variant_id") or str(authoritative_product_id),
                        sku=legacy_row.get("code") or legacy_row.get("sku") or legacy_row.get("style_code"),
                        barcode=legacy_row.get("barcode"),
                        name=legacy_row.get("name"),
                        brand=legacy_row.get("brand"),
                        category=legacy_row.get("category"),
                        category_code=legacy_row.get("category_code"),
                        uom="PAIR" if (legacy_row.get("category") or "").lower() in ["footwear", "socks"] else "NOS",
                        hsn_code=legacy_row.get("hsn_code") or "640411",
                        tax_rate=Decimal(str(legacy_row.get("gst_percentage") or "0.00")),
                        mrp=Decimal(str(legacy_row.get("mrp") or "0.00")),
                        selling_price=Decimal(str(legacy_row.get("price") or "0.00")),
                        cost_price=Decimal(str(legacy_row.get("cost_price") or "0.00")),
                        is_active=is_active,
                        is_quarantined=False,
                        resolution_source="LEGACY_FALLBACK",
                        matched_by=legacy_row.get("matched_by"),
                        product=dict(legacy_row),
                    )

        if not res:
            res = cls._build_not_found_result(q, identifier_type or "IDENTIFIER")

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0

        # Emit audit telemetry to CanonicalTelemetrySink
        CanonicalTelemetrySink.record_event({
            "timestamp": time.time(),
            "company_id": company_id,
            "query_value": q,
            "identifier_type": identifier_type or "AUTO",
            "status": "SUCCESS" if res.success else res.code,
            "matched_by": res.matched_by,
            "latency_ms": elapsed_ms,
            "resolved_product_id": res.product_id,
        })

        return res

    # -------------------------------------------------------------------------
    # Database Query Layers
    # -------------------------------------------------------------------------

    @classmethod
    async def _query_canonical(
        cls,
        session: AsyncSession,
        company_id: str,
        query: str,
        ident_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Queries canonical Item Master (item_barcodes, item_variants, items)."""
        # 1. Barcode Query
        if ident_type in (None, "BARCODE"):
            stmt_bc = text("""
                SELECT 
                    'BARCODE' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    i.is_active as item_is_active,
                    i.primary_uom,
                    v.id as variant_id,
                    v.variant_sku,
                    v.variant_name,
                    v.is_active as variant_is_active,
                    COALESCE(v.hsn_code, i.hsn_code) as hsn_code,
                    COALESCE(v.tax_rate, i.tax_rate, 0.00) as tax_rate,
                    ib.barcode,
                    COALESCE(pbe.selling_price, v.selling_price, i.selling_price, 0.00) as selling_price,
                    COALESCE(pbe.mrp, v.mrp, i.mrp, 0.00) as mrp,
                    COALESCE(pbe.cost_price, v.cost_price, i.cost_price, 0.00) as cost_price,
                    lim.legacy_id as legacy_product_id,
                    lim.disposition
                FROM item_barcodes ib
                JOIN item_variants v ON ib.variant_id = v.id
                JOIN items i ON v.item_id = i.id
                LEFT JOIN legacy_id_mappings lim 
                  ON lim.canonical_id = v.id AND lim.legacy_table = 'products'
                LEFT JOIN price_book_entries pbe 
                  ON pbe.variant_id = v.id AND pbe.is_deleted = false
                WHERE (ib.company_id = :cid OR ib.company_id IS NULL)
                  AND (ib.barcode = :q OR ib.barcode_normalized = :q)
                  AND ib.is_deleted = false
                ORDER BY (ib.company_id IS NOT NULL) DESC
                LIMIT 1
            """)
            row = (await session.execute(stmt_bc, {"cid": company_id, "q": query})).fetchone()
            if row:
                return dict(row._mapping)

        # 2. Product ID / Variant ID Query
        if ident_type in (None, "PRODUCT_ID"):
            stmt_id = text("""
                SELECT 
                    'PRODUCT_ID' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    i.is_active as item_is_active,
                    i.primary_uom,
                    v.id as variant_id,
                    v.variant_sku,
                    v.variant_name,
                    v.is_active as variant_is_active,
                    COALESCE(v.hsn_code, i.hsn_code) as hsn_code,
                    COALESCE(v.tax_rate, i.tax_rate, 0.00) as tax_rate,
                    ib.barcode,
                    COALESCE(pbe.selling_price, v.selling_price, i.selling_price, 0.00) as selling_price,
                    COALESCE(pbe.mrp, v.mrp, i.mrp, 0.00) as mrp,
                    COALESCE(pbe.cost_price, v.cost_price, i.cost_price, 0.00) as cost_price,
                    lim.legacy_id as legacy_product_id,
                    lim.disposition
                FROM item_variants v
                JOIN items i ON v.item_id = i.id
                LEFT JOIN item_barcodes ib ON ib.variant_id = v.id AND ib.is_primary = true AND ib.is_deleted = false
                LEFT JOIN legacy_id_mappings lim 
                  ON (lim.canonical_id = v.id OR lim.canonical_id = i.id OR lim.legacy_id = :q) AND lim.legacy_table = 'products'
                LEFT JOIN price_book_entries pbe 
                  ON pbe.variant_id = v.id AND pbe.is_deleted = false
                WHERE (v.company_id = :cid OR v.company_id IS NULL)
                  AND (v.id = :q OR i.id = :q OR lim.legacy_id = :q)
                  AND v.is_deleted = false
                ORDER BY (v.company_id IS NOT NULL) DESC
                LIMIT 1
            """)
            row = (await session.execute(stmt_id, {"cid": company_id, "q": query})).fetchone()
            if row:
                return dict(row._mapping)

        # 3. Variant SKU Query
        if ident_type in (None, "SKU"):
            stmt_sku = text("""
                SELECT 
                    'VARIANT_SKU' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    i.is_active as item_is_active,
                    i.primary_uom,
                    v.id as variant_id,
                    v.variant_sku,
                    v.variant_name,
                    v.is_active as variant_is_active,
                    COALESCE(v.hsn_code, i.hsn_code) as hsn_code,
                    COALESCE(v.tax_rate, i.tax_rate, 0.00) as tax_rate,
                    ib.barcode,
                    COALESCE(pbe.selling_price, v.selling_price, i.selling_price, 0.00) as selling_price,
                    COALESCE(pbe.mrp, v.mrp, i.mrp, 0.00) as mrp,
                    COALESCE(pbe.cost_price, v.cost_price, i.cost_price, 0.00) as cost_price,
                    lim.legacy_id as legacy_product_id,
                    lim.disposition
                FROM item_variants v
                JOIN items i ON v.item_id = i.id
                LEFT JOIN item_barcodes ib ON ib.variant_id = v.id AND ib.is_primary = true AND ib.is_deleted = false
                LEFT JOIN legacy_id_mappings lim 
                  ON lim.canonical_id = v.id AND lim.legacy_table = 'products'
                LEFT JOIN price_book_entries pbe 
                  ON pbe.variant_id = v.id AND pbe.is_deleted = false
                WHERE (v.company_id = :cid OR v.company_id IS NULL)
                  AND (v.variant_sku = :q OR v.variant_sku = UPPER(:q) OR v.variant_sku ILIKE :q)
                  AND v.is_deleted = false
                ORDER BY (v.company_id IS NOT NULL) DESC
                LIMIT 1
            """)
            row = (await session.execute(stmt_sku, {"cid": company_id, "q": query})).fetchone()
            if row:
                return dict(row._mapping)

        # 4. Parent Item Code Query
        if ident_type in (None, "SKU", "ITEM_CODE"):
            stmt_item = text("""
                SELECT 
                    'ITEM_CODE' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    i.is_active as item_is_active,
                    i.primary_uom,
                    v.id as variant_id,
                    COALESCE(v.variant_sku, i.item_code) as variant_sku,
                    COALESCE(v.variant_name, i.item_name) as variant_name,
                    COALESCE(v.is_active, i.is_active) as variant_is_active,
                    COALESCE(v.hsn_code, i.hsn_code) as hsn_code,
                    COALESCE(v.tax_rate, i.tax_rate, 0.00) as tax_rate,
                    ib.barcode,
                    COALESCE(v.selling_price, i.selling_price, 0.00) as selling_price,
                    COALESCE(v.mrp, i.mrp, 0.00) as mrp,
                    COALESCE(v.cost_price, i.cost_price, 0.00) as cost_price,
                    lim.legacy_id as legacy_product_id,
                    lim.disposition
                FROM items i
                LEFT JOIN item_variants v ON v.item_id = i.id AND v.is_deleted = false
                LEFT JOIN item_barcodes ib ON ib.variant_id = v.id AND ib.is_primary = true AND ib.is_deleted = false
                LEFT JOIN legacy_id_mappings lim 
                  ON (lim.canonical_id = v.id OR lim.canonical_id = i.id) AND lim.legacy_table = 'products'
                WHERE (i.company_id = :cid OR i.company_id IS NULL)
                  AND (i.item_code = :q OR i.item_code = UPPER(:q) OR i.item_code ILIKE :q)
                  AND i.is_deleted = false
                ORDER BY (i.company_id IS NOT NULL) DESC
                LIMIT 1
            """)
            row = (await session.execute(stmt_item, {"cid": company_id, "q": query})).fetchone()
            if row:
                return dict(row._mapping)

        return None

    @classmethod
    async def _query_legacy(
        cls,
        session: AsyncSession,
        company_id: str,
        query: str,
        ident_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Queries legacy products catalog table."""
        stmt = text("""
            SELECT 
                'LEGACY_PRODUCT' as matched_by,
                p.id,
                p.code,
                p.sku,
                p.name,
                p.style_code,
                p.brand,
                p.category,
                p.category_code,
                p.barcode,
                p.secondary_barcodes,
                p.price,
                p.mrp,
                p.cost_price,
                p.hsn_code,
                p.gst_percentage,
                p.is_active,
                p.is_deleted,
                p.item_id as canonical_item_id,
                p.item_variant_id as canonical_variant_id,
                lim.disposition
            FROM products p
            LEFT JOIN legacy_id_mappings lim 
              ON lim.legacy_id = p.id AND lim.legacy_table = 'products'
            WHERE (p.company_id = :cid OR p.company_id IS NULL)
              AND (
                (:type = 'PRODUCT_ID' AND p.id = :q)
                OR (:type = 'BARCODE' AND (p.barcode = :q OR :q = ANY(p.secondary_barcodes)))
                OR (:type = 'SKU' AND (p.code = :q OR p.code ILIKE :q OR p.sku = :q OR p.style_code ILIKE :q))
                OR (:type IS NULL AND (
                    p.id = :q 
                    OR p.barcode = :q 
                    OR :q = ANY(p.secondary_barcodes) 
                    OR p.code = :q 
                    OR p.code ILIKE :q 
                    OR p.sku = :q 
                    OR p.style_code ILIKE :q
                ))
              )
              AND p.is_deleted = false
            ORDER BY (p.company_id IS NOT NULL) DESC
            LIMIT 1
        """)
        row = (await session.execute(stmt, {"cid": company_id, "q": query, "type": ident_type})).fetchone()
        return dict(row._mapping) if row else None

    # -------------------------------------------------------------------------
    # Standard Error Builders conforming to HREP
    # -------------------------------------------------------------------------

    @classmethod
    def _build_not_found_result(
        cls,
        identifier: str,
        identifier_type: str,
        line_no: Optional[int] = None,
    ) -> ProductResolutionResult:
        type_label = identifier_type.replace("_", " ").title()
        explanation = f"{type_label} '{identifier}' was not found in Product List." if identifier else "Product was not found in Product List."
        err = ProductResolutionErrorDetail(
            code="PRODUCT_NOT_FOUND",
            title="Product Not Found",
            explanation=f"This product is not registered in Product List. {explanation}",
            suggested_action="Please add the product to Product List before continuing.",
            identifier=identifier,
            identifier_type=identifier_type,
            line_no=line_no,
        )
        return ProductResolutionResult(
            success=False,
            code="PRODUCT_NOT_FOUND",
            message=err.explanation,
            identifier=identifier,
            identifier_type=identifier_type,
            error_detail=err,
        )

    @classmethod
    def _build_inactive_result(
        cls,
        identifier: str,
        identifier_type: str,
        name: Optional[str] = None,
        line_no: Optional[int] = None,
    ) -> ProductResolutionResult:
        product_ref = f"'{name}' ({identifier})" if name else f"'{identifier}'"
        err = ProductResolutionErrorDetail(
            code="PRODUCT_INACTIVE",
            title="Product Inactive",
            explanation=f"Product {product_ref} exists in Product List but is currently inactive.",
            suggested_action="Please activate the product in Product List or choose an active product.",
            identifier=identifier,
            identifier_type=identifier_type,
            line_no=line_no,
        )
        return ProductResolutionResult(
            success=False,
            code="PRODUCT_INACTIVE",
            message=err.explanation,
            identifier=identifier,
            identifier_type=identifier_type,
            error_detail=err,
        )

    @classmethod
    def _build_quarantined_result(
        cls,
        identifier: str,
        identifier_type: str,
        line_no: Optional[int] = None,
    ) -> ProductResolutionResult:
        err = ProductResolutionErrorDetail(
            code="PRODUCT_QUARANTINED",
            title="Product Under Review",
            explanation=f"Product '{identifier}' is quarantined in REQUIRES_REVIEW state.",
            suggested_action="Manual catalog review is required before this item can be transacted.",
            identifier=identifier,
            identifier_type=identifier_type,
            line_no=line_no,
        )
        return ProductResolutionResult(
            success=False,
            code="PRODUCT_QUARANTINED",
            message=err.explanation,
            identifier=identifier,
            identifier_type=identifier_type,
            error_detail=err,
        )
