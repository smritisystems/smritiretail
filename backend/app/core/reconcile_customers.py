"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.15.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
from sqlalchemy.future import select
from sqlalchemy import update
try:
    from app.db.session import async_session
    from app.models.sales import SalesInvoice
    from app.models.crm import Customer
except ImportError:
    from backend.app.db.session import async_session
    from backend.app.models.sales import SalesInvoice
    from backend.app.models.crm import Customer


async def reconcile_orphan_invoice_customers():
    async with async_session() as db:
        # 1. Fetch all customer IDs
        cust_res = await db.execute(select(Customer.id))
        valid_customer_ids = set(cust_res.scalars().all())

        # 2. Fetch all invoices
        inv_res = await db.execute(select(SalesInvoice))
        invoices = inv_res.scalars().all()

        reconciled_count = 0
        for inv in invoices:
            if not inv.customer_id or inv.customer_id not in valid_customer_ids:
                # Re-link orphan invoice to CUST-WALKIN
                target_id = "CUST-WALKIN"
                inv.customer_id = target_id
                if not inv.customer_name:
                    inv.customer_name = "Walk-In / Cash Customer"
                reconciled_count += 1

        if reconciled_count > 0:
            await db.commit()
            print(f"SUCCESS: Reconciled {reconciled_count} orphan invoices to canonical customer records.")
        else:
            print("SUCCESS: 0 orphan invoices found. All invoice customer relations are 100% valid.")


if __name__ == "__main__":
    asyncio.run(reconcile_orphan_invoice_customers())
