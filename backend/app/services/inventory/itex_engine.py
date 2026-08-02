"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Description  : Inventory Transaction Engine (ITEX) — Single entry orchestrator converting business documents into atomic ledger directives.
"""

from decimal import Decimal
from typing import Any, List, Optional, Dict
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...models.inventory import Product, StockMovement
from ...models.inventory_kernel import (
    InventoryLedgerEntry,
    DocumentPostingProfileRecord,
)
from .ilg_engine import InventoryLedgerEngine


class InventoryTransactionEngine:
    """
    Inventory Transaction Engine (ITEX)
    Enforces Rule 1 (ITEX Single Entry Rule):
    Single orchestrator receiving all commercial business transactions (GRN, Invoice, POS, Transfer, Count)
    and converting them into atomic movement directives posted via ILG.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.ilg_engine = InventoryLedgerEngine(db, tenant_ctx)

    async def execute_transaction(
        self,
        transaction_id: str,
        from_location_id: Optional[str],
        to_location_id: Optional[str],
        items: List[Dict[str, Any]],
        movement_type: str,
        document_no: Optional[str] = None,
        ownership_type: str = "COMPANY",
        posting_profile_id: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> List[InventoryLedgerEntry]:
        """
        Processes commercial transaction lines and delegates append-only posting to ILG.
        Also creates legacy StockMovement records for backward compatibility during transition.
        """
        ledger_entries: List[InventoryLedgerEntry] = []

        for item in items:
            product_id = item["product_id"]
            quantity = Decimal(str(item["quantity"]))
            sku = item.get("sku", "")
            unit_cost = Decimal(str(item.get("unit_cost", "0.00")))
            batch_no = item.get("batch_no")
            serial_no = item.get("serial_no")

            # Fetch product details if SKU or unit_cost missing
            if not sku or unit_cost == Decimal("0.00"):
                stmt = select(Product).where(
                    Product.id == product_id,
                    Product.company_id == self.tenant_ctx.company_id,
                )
                res = await self.db.execute(stmt)
                product = res.scalars().first()
                if product:
                    sku = sku or product.sku or product.code
                    unit_cost = unit_cost or product.cost_price or product.price or Decimal("0.00")

            # 1. Post to append-only InventoryLedger via ILG
            entry = await self.ilg_engine.post_ledger_entry(
                transaction_id=transaction_id,
                from_location_id=from_location_id,
                to_location_id=to_location_id,
                product_id=product_id,
                sku=sku or "SKU-UNKNOWN",
                quantity=quantity,
                movement_type=movement_type,
                unit_cost=unit_cost,
                batch_no=batch_no,
                serial_no=serial_no,
                document_no=document_no,
                ownership_type=ownership_type,
                posting_profile_id=posting_profile_id,
                remarks=remarks,
            )
            ledger_entries.append(entry)

            # 2. Maintain legacy StockMovement line for backwards compatibility
            ts = int(datetime.now(timezone.utc).timestamp() * 1000)
            legacy_movement = StockMovement(
                id=f"SM-{ts}-{uuid.uuid4().hex[:6]}",
                uuid=str(uuid.uuid4()),
                product_id=product_id,
                product_name=item.get("product_name", sku),
                sku=sku or "SKU-UNKNOWN",
                quantity=quantity if to_location_id else -quantity,
                movement_type=movement_type,
                reference_doc_type=item.get("reference_doc_type", "Business Transaction"),
                reference_doc_id=document_no or transaction_id,
                warehouse=from_location_id or to_location_id or "Default Warehouse",
                unit_cost=unit_cost,
                remarks=remarks or f"ITEX Transaction: {transaction_id}",
                source_module=item.get("source_module", "ITEX"),
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            )
            self.db.add(legacy_movement)

        return ledger_entries
