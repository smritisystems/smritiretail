"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.14.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-07-12
# Modified     : 2026-07-12
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software

import os
import sys
import json
import asyncio
import re
from datetime import datetime, timezone
from decimal import Decimal

# Add root folder to sys.path to enable backend imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db.session import async_session
from backend.app.models.tenant import Company, Branch
from backend.app.models.auth import User, UserRole
from backend.app.models.crm import CustomerGroup, Customer
from backend.app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem
from backend.app.models.pos import CashRegister, Shift
from backend.app.models.inventory import Product
from sqlalchemy import select

def map_role(role_str: str) -> UserRole:
    role_upper = role_str.upper().replace(" ", "_")
    if "ADMIN" in role_upper or "OWNER" in role_upper:
        return UserRole.SYSADMIN
    elif "MANAGER" in role_upper:
        return UserRole.MANAGER
    elif "CASHIER" in role_upper:
        return UserRole.CASHIER
    else:
        return UserRole.VIEWER

async def migrate():
    # Load JSON file
    db_store_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../db_store.json"))
    if not os.path.exists(db_store_path):
        print(f"Error: db_store.json not found at {db_store_path}")
        return

    with open(db_store_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    companies_list = data.get("companies", [])
    branches_list = data.get("branches", [])
    default_company_id = companies_list[0].get("id") if companies_list else None
    default_branch_id = branches_list[0].get("id") if branches_list else None

    async with async_session() as session:
        # 1. Migrate Companies
        for c in companies_list:
            cid = c.get("id")
            existing = await session.get(Company, cid)
            if existing:
                print(f"[Warning] Company {cid} already in Postgres. Skipping.")
                continue
            db_company = Company(
                id=cid,
                name=c.get("name"),
                gst_number=c.get("gstNumber"),
                is_active=c.get("status") == "Active" if "status" in c else True
            )
            session.add(db_company)
        await session.commit()

        # 2. Migrate Branches
        for b in branches_list:
            bid = b.get("id")
            existing = await session.get(Branch, bid)
            if existing:
                print(f"[Warning] Branch {bid} already in Postgres. Skipping.")
                continue
            db_branch = Branch(
                id=bid,
                company_id=b.get("company") or b.get("companyId") or default_company_id,
                name=b.get("name"),
                code=b.get("code")
            )
            session.add(db_branch)
        await session.commit()

        # 3. Migrate Users
        users_list = data.get("users", [])
        for u in users_list:
            uid = u.get("id")
            existing = await session.get(User, uid)
            if existing:
                print(f"[Warning] User {uid} already in Postgres. Skipping.")
                continue

            company_id = u.get("companyId") or u.get("company")
            branch_id = u.get("branchId") or u.get("branch")
            if not company_id and branch_id:
                branch_item = next((br for br in branches_list if br.get("id") == branch_id), None)
                if branch_item:
                    company_id = branch_item.get("company") or branch_item.get("companyId")
            
            db_user = User(
                id=uid,
                username=u.get("username"),
                email=u.get("email"),
                mobile=u.get("mobile"),
                hashed_password=u.get("passwordHash"),
                role=map_role(u.get("role", "CASHIER")),
                company_id=company_id or default_company_id,
                branch_id=branch_id or default_branch_id
            )
            session.add(db_user)
        await session.commit()

        # 4. Migrate Customer Groups
        cg_list = data.get("customerGroups", [])
        for cg in cg_list:
            cgid = cg.get("id")
            existing = await session.get(CustomerGroup, cgid)
            if existing:
                print(f"[Warning] CustomerGroup {cgid} already in Postgres. Skipping.")
                continue
            db_cg = CustomerGroup(
                id=cgid,
                name=cg.get("name"),
                discount_percentage=Decimal(str(cg.get("maxDiscountPercent", 0))),
                allow_credit=cg.get("canPurchaseOnCredit", False),
                company_id=default_company_id,
                branch_id=default_branch_id
            )
            session.add(db_cg)
        await session.commit()

        # 5. Migrate Customers
        cust_list = data.get("customers", [])
        for cust in cust_list:
            cust_id = cust.get("id")
            existing = await session.get(Customer, cust_id)
            if existing:
                print(f"[Warning] Customer {cust_id} already in Postgres. Skipping.")
                continue
            
            tags = cust.get("tags", [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",") if t.strip()]

            db_cust = Customer(
                id=cust_id,
                customer_group_id=cust.get("customerGroupId"),
                name=cust.get("name"),
                mobile=cust.get("mobile"),
                email=cust.get("email"),
                gst_number=cust.get("gstNumber"),
                outstanding=Decimal(str(cust.get("outstanding", 0.00))),
                status=cust.get("status", "Active"),
                tags=tags,
                company_id=default_company_id,
                branch_id=default_branch_id
            )
            session.add(db_cust)
        await session.commit()

        # 6. Migrate Suppliers
        sup_list = data.get("suppliers", [])
        for s in sup_list:
            sid = s.get("id")
            existing = await session.get(Supplier, sid)
            if existing:
                print(f"[Warning] Supplier {sid} already in Postgres. Skipping.")
                continue

            contact = s.get("contactDetails", "")
            mobile_match = re.search(r"Mobile:\s*([^\s,]+)", contact)
            email_match = re.search(r"Email:\s*([^\s,]+)", contact)
            mobile = mobile_match.group(1) if mobile_match else None
            email = email_match.group(1) if email_match else None

            db_sup = Supplier(
                id=sid,
                name=s.get("name"),
                code=s.get("vendorCode"),
                gst_number=s.get("taxRegistrationNumber"),
                mobile=mobile,
                email=email,
                address=s.get("address"),
                company_id=default_company_id,
                branch_id=default_branch_id
            )
            session.add(db_sup)
        await session.commit()

        # 7. Migrate Purchase Orders
        po_list = data.get("purchaseOrders", [])
        for po in po_list:
            poid = po.get("id")
            existing = await session.get(PurchaseOrder, poid)
            if existing:
                print(f"[Warning] PurchaseOrder {poid} already in Postgres. Skipping.")
                continue

            db_po = PurchaseOrder(
                id=poid,
                order_no=po.get("orderNo"),
                supplier_id=po.get("supplierId"),
                status=po.get("status", "DRAFT"),
                notes=po.get("remarks"),
                tax_total=Decimal(str(po.get("taxTotal", 0.00))),
                grand_total=Decimal(str(po.get("grandTotal", 0.00))),
                company_id=default_company_id,
                branch_id=default_branch_id
            )
            session.add(db_po)

            po_items = po.get("items", [])
            for item in po_items:
                pid = item.get("productId")
                # Ensure product exists
                res = await session.execute(select(Product).where(Product.id == pid))
                existing_product = res.scalars().first()
                if not existing_product:
                    print(f"Product {pid} not found in database. Creating dummy product...")
                    dummy_product = Product(
                        id=pid,
                        code=item.get("code") or f"CODE-{pid}",
                        name=item.get("name") or f"Product {pid}",
                        price=Decimal(str(item.get("price", 0.00))),
                        stock=0,
                        category="General",
                        barcode=f"BC-{pid}",
                        company_id=default_company_id,
                        branch_id=default_branch_id
                    )
                    session.add(dummy_product)
                    await session.flush()

                db_item = PurchaseOrderItem(
                    id=f"poi-{poid}-{item.get('productId')}",
                    order_id=poid,
                    product_id=item.get("productId"),
                    code=item.get("code"),
                    name=item.get("name"),
                    quantity=Decimal(str(item.get("quantity", 0))),
                    cost_price=Decimal(str(item.get("price", 0.00))),
                    gst_rate=Decimal(str(item.get("taxRate", 18.00))),
                    tax_amount=Decimal(str(item.get("taxAmount", 0.00))),
                    line_total=Decimal(str(item.get("totalAmount", 0.00))),
                    company_id=default_company_id,
                    branch_id=default_branch_id
                )
                session.add(db_item)
        await session.commit()

        # 8. Migrate Cash Registers (POS Profiles)
        profiles_list = data.get("profiles", [])
        for p in profiles_list:
            pid = p.get("id")
            existing = await session.get(CashRegister, pid)
            if existing:
                print(f"[Warning] CashRegister {pid} already in Postgres. Skipping.")
                continue
            db_reg = CashRegister(
                id=pid,
                name=p.get("name"),
                code=pid,
                notes=f"Warehouse: {p.get('warehouse')}",
                company_id=default_company_id,
                branch_id=default_branch_id
            )
            session.add(db_reg)
        await session.commit()

        # 9. Migrate Shifts
        shifts_list = data.get("shifts", [])
        for sh in shifts_list:
            shid = sh.get("id")
            existing = await session.get(Shift, shid)
            if existing:
                print(f"[Warning] Shift {shid} already in Postgres. Skipping.")
                continue

            cashier_name = sh.get("cashier")
            cashier_id = None
            if cashier_name:
                res = await session.execute(
                    select(User.id).where((User.fullName == cashier_name) | (User.username == cashier_name))
                )
                cashier_id = res.scalars().first()
            if not cashier_id:
                res = await session.execute(
                    select(User.id).where(User.role == UserRole.CASHIER)
                )
                cashier_id = res.scalars().first() or "usr-test"

            db_shift = Shift(
                id=shid,
                register_id=sh.get("profileId"),
                cashier_id=cashier_id,
                status=sh.get("status", "OPEN").upper(),
                opened_at=datetime.fromisoformat(sh.get("openedAt").replace("Z", "+00:00")),
                closed_at=datetime.fromisoformat(sh.get("closedAt").replace("Z", "+00:00")) if sh.get("closedAt") else None,
                opening_balance=Decimal(str(sh.get("openingBalance", 0.00))),
                closing_balance=Decimal(str(sh.get("closingBalance"))) if sh.get("closingBalance") is not None else None,
                cash_sales_total=Decimal(str(sh.get("salesValue", 0.00))),
                total_sales=Decimal(str(sh.get("salesValue", 0.00))),
                total_invoices=str(sh.get("salesCount", 0)),
                company_id=default_company_id,
                branch_id=default_branch_id
            )
            session.add(db_shift)
        await session.commit()

    print("Migration of Tier 4 entities completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
