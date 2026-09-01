"""
Patch pos.py to ensure clean Gate 11C Dual-Key Canonical Write Authority.
"""

def patch():
    with open('backend/app/services/pos.py', 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    lines = content.splitlines(keepends=True)
    prefix = ''.join(lines[:1046])

    clean_method = '''

    # ---------------------------------------------------------------
    # POS Checkout (Phase 1 -- Canonical Dual-Key Write Authority)
    # ---------------------------------------------------------------

    async def pos_checkout(self, req: POSCheckoutRequest) -> dict:
        """
        Process a POS sale with Gate 11C Dual-Key Canonical Write Authority:
        1. Validate shift is OPEN and belongs to this tenant.
        2. Idempotency: if invoice_no already exists, return it (cached=True).
        3. Resolve canonical variant_id and legacy product_id via CanonicalTransactionWriter.
        4. Deduct stock and record StockMovement with dual keys.
        5. Persist SalesInvoice with dual-keyed SalesInvoiceItem lines.
        6. Commit atomically.

        Returns {"invoice": SalesInvoice, "shift": Shift, "cached": bool}
        """
        resolver = InventoryWarehouseResolver(self.db)

        # 1. Validate shift with pessimistic row locking to prevent race with shift close
        shift = await self.get_shift(req.shift_id, for_update=True)
        if shift.status != "OPEN":
            raise HTTPException(
                status_code=400,
                detail="The shift is not open. Please open a shift before processing sales.",
            )

        # 2. Idempotency check (pre-insert)
        existing_res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.invoice_no == req.invoice_no,
                SalesInvoice.company_id == self.tenant.company_id,
                SalesInvoice.is_deleted == False,
            )
        )
        if (existing_inv := existing_res.scalars().first()):
            return {"invoice": existing_inv, "shift": shift, "cached": True}

        # 3. Compute totals and build item records
        tax_total   = Decimal("0.00")
        grand_total = Decimal("0.00")
        invoice_id  = uuid.uuid4().hex[:8]
        db_items:   list[SalesInvoiceItem] = []
        movements:  list[StockMovement]    = []

        for item in req.items:
            qty   = item.quantity
            price = item.price
            gst   = item.gst_rate

            item_tax   = (qty * price * gst / Decimal("100.00")).quantize(Decimal("0.0001"))
            item_total = (qty * price + item_tax).quantize(Decimal("0.01"))
            tax_total   += item_tax
            grand_total += item_total

            # Gate 11C Dual-Key Canonical Resolution
            dual_key = await CanonicalTransactionWriter.resolve_dual_key_for_line(
                session=self.db,
                company_id=self.tenant.company_id,
                variant_id=getattr(item, "variant_id", None),
                product_id=item.product_id,
                code_or_barcode=item.code,
                is_fee_line=False,
            )
            if dual_key.is_quarantined:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line item '{item.name}' ({dual_key.sku or item.code}) is locked under catalog review and cannot be transacted.",
                )

            target_product_id = dual_key.legacy_product_id or item.product_id
            target_variant_id = dual_key.canonical_variant_id

            db_items.append(SalesInvoiceItem(
                product_id=target_product_id,
                variant_id=target_variant_id,
                code=item.code,
                name=item.name,
                quantity=qty,
                price=price,
                hsn_code=item.hsn_code,
                gst_rate=gst,
                tax_amount=item_tax,
                total_amount=item_total,
            ))

            # Stock deduction
            prod_res = await self.db.execute(
                select(Product).where(
                    Product.id         == target_product_id,
                    Product.company_id == self.tenant.company_id,
                    Product.branch_id  == self.tenant.branch_id,
                    Product.is_deleted == False,
                )
            )
            product = prod_res.scalars().first()
            if product and product.tracking_mode != "No-stock":
                if product.stock < int(qty):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for '{item.name}'. "
                               f"Available: {product.stock}, requested: {int(qty)}.",
                    )
                product.stock = int(product.stock) - int(qty)
                product.modified_at = datetime.now(timezone.utc)
                self.db.add(product)

                movement_id = (
                    f"SM-{int(datetime.now(timezone.utc).timestamp())}-"
                    f"{uuid.uuid4().hex[:6]}"
                )
                resolved_warehouse = await resolver.resolve(company_id=self.tenant.company_id, branch_id=self.tenant.branch_id)
                movements.append(StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=target_product_id,
                    variant_id=target_variant_id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-qty,
                    movement_type="OUT",
                    reference_doc_type="POS Invoice",
                    reference_doc_id=invoice_id,
                    warehouse_id=resolved_warehouse.id,
                    warehouse=resolved_warehouse.name,
                    unit_cost=product.cost_price or product.price,
                    remarks=f"POS sale: {req.invoice_no}",
                    source_module="POS",
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                ))
'''

    suffix = ''.join(lines[1175:])
    new_content = prefix + clean_method + '\n' + suffix
    with open('backend/app/services/pos.py', 'w', encoding='utf-8') as f:
        f.write(new_content)

    print('Cleaned pos.py successfully!')

if __name__ == "__main__":
    patch()
