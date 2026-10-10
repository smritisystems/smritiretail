"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Item Resolver & Shadow Engine (Gate 8)
"""

import os
import logging
import time
import uuid
from typing import Optional, Dict, Any, List, Tuple
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger("smriti.resolver")


from app.core.cohort import CohortEvaluator
from app.services.canonical_telemetry_sink import CanonicalTelemetrySink

_telemetry_records: List[Dict[str, Any]] = []


class CanonicalItemResolver:
    """
    Unified Operational Item & Barcode Resolver for POS, Sales, Purchase, and Inventory.
    Supports:
      1. Configuration-Driven Dynamic Rollout Cohort Evaluation
      2. Canonical Primary with Structured Legacy Fallback & Reason Tracking
      3. Shadow Read Mode with Non-Blocking Divergence Telemetry
      4. Durable Telemetry Persistence & Alerting via CanonicalTelemetrySink
    """

    @classmethod
    def get_telemetry_records(cls) -> List[Dict[str, Any]]:
        return CanonicalTelemetrySink.get_events()

    @classmethod
    def clear_telemetry(cls) -> None:
        _telemetry_records.clear()
        CanonicalTelemetrySink.clear_durable_log()

    @classmethod
    async def resolve(
        cls,
        session: AsyncSession,
        company_id: str,
        query_str: str,
        branch_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
        request_id: Optional[str] = None,
        canonical_primary: Optional[bool] = None,
        shadow_compare: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Resolves query_str across Barcode, Variant SKU, and Parent Item Code.
        Strictly enforces tenant context (company_id).
        Dynamically evaluates cohort configuration to determine primary read authority.
        """
        if not company_id or not str(company_id).strip():
            raise ValueError("Multi-tenant security violation: company_id is mandatory")

        q = str(query_str).strip()
        if not q:
            return None

        # Dynamically evaluate cohort assignment or use explicit override if provided
        if canonical_primary is not None:
            is_canonical_cohort = canonical_primary
        else:
            is_canonical_cohort = CohortEvaluator.is_canonical_read_enabled(
                company_id=company_id,
                branch_id=branch_id,
                user_id=user_id,
                user_role=user_role
            )

        t_start = time.perf_counter()
        fallback_triggered = False
        fallback_reason = "NONE"
        canonical_hit = False
        divergence_detected = False
        divergence_details: Dict[str, Any] = {}
        resolution_source = "CANONICAL_PRIMARY" if is_canonical_cohort else "LEGACY_AUTHORITATIVE"
        result: Optional[Dict[str, Any]] = None

        if is_canonical_cohort:
            # Stage 1: Canonical Primary with Structured Legacy Fallback
            try:
                result = await cls._resolve_canonical(session, company_id, q)
                if result:
                    canonical_hit = True
                else:
                    fallback_triggered = True
                    fallback_reason = "NOT_IN_CANONICAL_UNMIGRATED"
            except TimeoutError as te:
                fallback_triggered = True
                fallback_reason = "CANONICAL_TIMEOUT"
                logger.warning(f"Canonical timeout for '{q}': {te}. Triggering fallback.")
            except Exception as e:
                fallback_triggered = True
                fallback_reason = "CANONICAL_EXCEPTION"
                logger.warning(f"Canonical exception for '{q}': {e}. Triggering fallback.")

            if canonical_hit:
                if shadow_compare:
                    try:
                        legacy_res = await cls._resolve_legacy(session, company_id, q)
                        div_log = cls._audit_shadow_divergence(q, legacy_res, result)
                        if div_log:
                            divergence_detected = True
                            divergence_details = div_log
                    except Exception as e:
                        logger.warning(f"Shadow legacy comparison error for '{q}': {e}")
            else:
                # Execute Legacy Fallback
                resolution_source = "LEGACY_FALLBACK"
                logger.info(f"Fallback triggered for '{q}'. Reason: {fallback_reason}")
                result = await cls._resolve_legacy(session, company_id, q)
        else:
            # Legacy Authoritative Mode (with optional shadow)
            result = await cls._resolve_legacy(session, company_id, q)
            if shadow_compare:
                try:
                    canonical_res = await cls._resolve_canonical(session, company_id, q)
                    div_log = cls._audit_shadow_divergence(q, result, canonical_res)
                    if div_log:
                        divergence_detected = True
                        divergence_details = div_log
                except Exception as e:
                    logger.warning(f"Shadow canonical comparison error for '{q}': {e}")

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0

        # Record Structured Observability Telemetry
        telemetry_event = {
            "timestamp": time.time(),
            "request_id": request_id or f"req_{uuid.uuid4().hex[:8]}",
            "company_id": company_id,
            "branch_id": branch_id,
            "user_id": user_id,
            "user_role": user_role,
            "cohort_enabled": is_canonical_cohort,
            "query_value": q,
            "matched_tier": result.get("matched_by") if result else "NOT_FOUND",
            "canonical_hit": canonical_hit,
            "fallback_triggered": fallback_triggered,
            "fallback_reason": fallback_reason,
            "divergence_detected": divergence_detected,
            "divergence_details": divergence_details,
            "resolution_source": resolution_source,
            "latency_ms": elapsed_ms,
            "resolved_sku": result.get("variant_sku") if result else None,
            "status": "SUCCESS" if result else "NOT_FOUND"
        }
        _telemetry_records.append(telemetry_event)
        CanonicalTelemetrySink.record_event(telemetry_event)

        return result

    @classmethod
    async def _resolve_canonical(
        cls,
        session: AsyncSession,
        company_id: str,
        query: str
    ) -> Optional[Dict[str, Any]]:
        """
        4-Tier Canonical Resolution:
        1. Exact Barcode Match
        2. Exact Variant SKU Match
        3. Exact Parent Item Code Match
        """
        # Tier 1: Barcode Lookup
        res_bc = await session.execute(
            text("""
                SELECT 
                    'BARCODE' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    v.id as variant_id,
                    v.variant_sku,
                    v.variant_name,
                    v.attributes_json,
                    COALESCE(v.hsn_code, i.hsn_code) as hsn_code,
                    COALESCE(v.tax_rate, i.tax_rate, 0.00) as tax_rate,
                    ib.barcode,
                    pbe.selling_price,
                    pbe.mrp,
                    pbe.cost_price
                FROM item_barcodes ib
                JOIN item_variants v ON ib.variant_id = v.id
                JOIN items i ON v.item_id = i.id
                LEFT JOIN price_book_entries pbe ON pbe.variant_id = v.id AND pbe.is_deleted = false
                WHERE ib.company_id = :cid
                  AND ib.barcode = :q
                  AND ib.is_deleted = false
                LIMIT 1
            """),
            {"cid": company_id, "q": query}
        )
        row = res_bc.fetchone()
        if row:
            return dict(row._mapping)

        # Tier 2: Variant SKU Lookup (Optimized index match)
        res_sku = await session.execute(
            text("""
                SELECT 
                    'VARIANT_SKU' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    v.id as variant_id,
                    v.variant_sku,
                    v.variant_name,
                    v.attributes_json,
                    COALESCE(v.hsn_code, i.hsn_code) as hsn_code,
                    COALESCE(v.tax_rate, i.tax_rate, 0.00) as tax_rate,
                    ib.barcode,
                    pbe.selling_price,
                    pbe.mrp,
                    pbe.cost_price
                FROM item_variants v
                JOIN items i ON v.item_id = i.id
                LEFT JOIN item_barcodes ib ON ib.variant_id = v.id AND ib.is_primary = true
                LEFT JOIN price_book_entries pbe ON pbe.variant_id = v.id AND pbe.is_deleted = false
                WHERE v.company_id = :cid
                  AND (v.variant_sku = :q OR v.variant_sku = UPPER(:q) OR v.variant_sku ILIKE :q)
                  AND v.is_deleted = false
                LIMIT 1
            """),
            {"cid": company_id, "q": query}
        )
        row = res_sku.fetchone()
        if row:
            return dict(row._mapping)

        # Tier 3: Parent Item Code Lookup (Optimized index match)
        res_itm = await session.execute(
            text("""
                SELECT 
                    'ITEM_CODE' as matched_by,
                    i.id as item_id,
                    i.item_code,
                    i.item_name,
                    i.brand,
                    i.category,
                    i.category_code,
                    i.status as item_status,
                    NULL as variant_id,
                    NULL as variant_sku,
                    NULL as variant_name,
                    '{}'::jsonb as attributes_json,
                    i.hsn_code,
                    COALESCE(i.tax_rate, 0.00) as tax_rate,
                    NULL as barcode,
                    0.00 as selling_price,
                    0.00 as mrp,
                    0.00 as cost_price
                FROM items i
                WHERE i.company_id = :cid
                  AND (i.item_code = :q OR i.item_code = UPPER(:q) OR i.item_code ILIKE :q)
                  AND i.is_deleted = false
                LIMIT 1
            """),
            {"cid": company_id, "q": query}
        )
        row = res_itm.fetchone()
        if row:
            return dict(row._mapping)

        return None

    @classmethod
    async def _resolve_legacy(
        cls,
        session: AsyncSession,
        company_id: str,
        query: str
    ) -> Optional[Dict[str, Any]]:
        """
        Legacy product resolver querying products table.
        """
        res = await session.execute(
            text("""
                SELECT 
                    'LEGACY_PRODUCT' as matched_by,
                    p.id as item_id,
                    p.style_code as item_code,
                    p.name as item_name,
                    p.brand,
                    p.category,
                    p.category_code,
                    'ACTIVE' as item_status,
                    p.id as variant_id,
                    p.code as variant_sku,
                    p.name as variant_name,
                    json_build_object('color', p.color, 'size', p.size)::jsonb as attributes_json,
                    p.hsn_code,
                    COALESCE(p.gst_percentage, 0.00) as tax_rate,
                    p.barcode,
                    p.price as selling_price,
                    p.mrp,
                    p.cost_price
                FROM products p
                WHERE p.company_id = :cid
                  AND (p.barcode = :q OR :q = ANY(p.secondary_barcodes) OR p.code ILIKE :q OR p.style_code ILIKE :q)
                  AND p.is_deleted = false
                LIMIT 1
            """),
            {"cid": company_id, "q": query}
        )
        row = res.fetchone()
        return dict(row._mapping) if row else None

    @classmethod
    def _audit_shadow_divergence(
        cls,
        query: str,
        legacy: Optional[Dict[str, Any]],
        canonical: Optional[Dict[str, Any]]
    ):
        """
        Non-blocking shadow divergence comparison.
        """
        if not legacy and not canonical:
            return
        if not legacy or not canonical:
            logger.warning(f"[SHADOW_DIVERGENCE] Query '{query}': Legacy={legacy is not None}, Canonical={canonical is not None}")
            return

        divergences = []
        if str(legacy.get("variant_sku")) != str(canonical.get("variant_sku")):
            divergences.append(f"SKU mismatch ({legacy.get('variant_sku')} vs {canonical.get('variant_sku')})")
        if Decimal(str(legacy.get("selling_price") or 0)) != Decimal(str(canonical.get("selling_price") or 0)):
            divergences.append(f"Price mismatch ({legacy.get('selling_price')} vs {canonical.get('selling_price')})")
        if Decimal(str(legacy.get("mrp") or 0)) != Decimal(str(canonical.get("mrp") or 0)):
            divergences.append(f"MRP mismatch ({legacy.get('mrp')} vs {canonical.get('mrp')})")

        if divergences:
            logger.warning(f"[SHADOW_DIVERGENCE] Query '{query}': {', '.join(divergences)}")
            return {"query": query, "divergences": divergences}
        return None
