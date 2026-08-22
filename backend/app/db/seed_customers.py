"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.9.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
from datetime import date
from decimal import Decimal
from sqlalchemy import select
try:
    from app.db.session import async_session
    from app.models.crm import Customer, CustomerGroup
    from app.models.tenant import Company, Branch
except ImportError:
    from backend.app.db.session import async_session
    from backend.app.models.crm import Customer, CustomerGroup
    from backend.app.models.tenant import Company, Branch


CANONICAL_CUSTOMER_GROUPS = [
    {
        "id": "CG-Retail",
        "name": "Retail Customers",
        "credit_limit": Decimal("20000.00"),
        "unlimited_credit": False,
        "credit_days": 0,
        "grace_days": 2,
        "credit_hold": False,
        "auto_block_sales": True,
        "warning_threshold_percent": Decimal("80.00"),
        "allow_override": False,
        "tax_inclusive": True,
        "max_discount_percent": Decimal("10.00"),
        "min_margin_percent": Decimal("15.00"),
        "rounding_rule": "Nearest1",
        "allowed_payment_methods": ["Cash", "UPI", "Card"],
        "preferred_payment_method": "UPI",
        "allow_back_orders": False,
        "allow_negative_stock_sales": False,
        "require_po_number": False,
        "invoice_language": "en",
        "can_view_price": True,
        "can_view_margin": False,
        "can_purchase_on_credit": False,
        "can_receive_discount": True,
    },
    {
        "id": "CG-LargeRetail",
        "name": "Large Retail & Corporate",
        "credit_limit": Decimal("500000.00"),
        "unlimited_credit": False,
        "credit_days": 60,
        "grace_days": 15,
        "credit_hold": False,
        "auto_block_sales": true if False else True,
        "warning_threshold_percent": Decimal("85.00"),
        "allow_override": True,
        "tax_inclusive": True,
        "max_discount_percent": Decimal("20.00"),
        "min_margin_percent": Decimal("10.00"),
        "rounding_rule": "Nearest1",
        "allowed_payment_methods": ["BankTransfer", "Cheque", "UPI"],
        "preferred_payment_method": "BankTransfer",
        "allow_back_orders": True,
        "allow_negative_stock_sales": True,
        "require_po_number": True,
        "invoice_language": "en",
        "can_view_price": True,
        "can_view_margin": True,
        "can_purchase_on_credit": True,
        "can_receive_discount": True,
    },
    {
        "id": "CG-Branches",
        "name": "Internal Branches",
        "credit_limit": Decimal("0.00"),
        "unlimited_credit": True,
        "credit_days": 90,
        "grace_days": 30,
        "credit_hold": False,
        "auto_block_sales": False,
        "warning_threshold_percent": Decimal("95.00"),
        "allow_override": True,
        "tax_inclusive": True,
        "max_discount_percent": Decimal("0.00"),
        "min_margin_percent": Decimal("0.00"),
        "rounding_rule": "Nearest1",
        "allowed_payment_methods": ["Cash", "UPI", "BankTransfer"],
        "preferred_payment_method": "BankTransfer",
        "allow_back_orders": True,
        "allow_negative_stock_sales": True,
        "require_po_number": False,
        "invoice_language": "en",
        "can_view_price": True,
        "can_view_margin": True,
        "can_purchase_on_credit": True,
        "can_receive_discount": False,
    },
    {
        "id": "CG-Franchises",
        "name": "Franchise Partners",
        "credit_limit": Decimal("300000.00"),
        "unlimited_credit": False,
        "credit_days": 45,
        "grace_days": 10,
        "credit_hold": False,
        "auto_block_sales": True,
        "warning_threshold_percent": Decimal("80.00"),
        "allow_override": True,
        "tax_inclusive": True,
        "max_discount_percent": Decimal("15.00"),
        "min_margin_percent": Decimal("12.00"),
        "rounding_rule": "Nearest1",
        "allowed_payment_methods": ["Cash", "UPI", "BankTransfer"],
        "preferred_payment_method": "BankTransfer",
        "allow_back_orders": True,
        "allow_negative_stock_sales": False,
        "require_po_number": False,
        "invoice_language": "en",
        "can_view_price": True,
        "can_view_margin": False,
        "can_purchase_on_credit": True,
        "can_receive_discount": True,
    }
]

CANONICAL_CUSTOMERS = [
    {
        "id": "CUST-WALKIN",
        "code": "CUST-WALKIN",
        "customer_group_id": "CG-Retail",
        "name": "Walk-In / Cash Customer",
        "mobile": "9999999999",
        "email": "cash@smritiretail.com",
        "outstanding": Decimal("0.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Walk-In", "Cash", "B2C"],
    },
    {
        "id": "CUST-001",
        "code": "CUST-001",
        "customer_group_id": "CG-Retail",
        "name": "Rahul Sharma",
        "mobile": "9876543210",
        "email": "rahul.sharma@gmail.com",
        "outstanding": Decimal("15000.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["VIP", "Retail"],
    },
    {
        "id": "CUST-002",
        "code": "CUST-002",
        "customer_group_id": "CG-LargeRetail",
        "name": "Super Textiles Ltd",
        "mobile": "9988776655",
        "email": "finance@supertextiles.com",
        "gst_number": "27AAACS1094J1Z3",
        "outstanding": Decimal("450000.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Wholesale", "Corporate"],
    },
    {
        "id": "CUST-003",
        "code": "CUST-003",
        "customer_group_id": "CG-Branches",
        "name": "Branch - South Delhi",
        "mobile": "9911223344",
        "email": "southdelhi@smriti.com",
        "outstanding": Decimal("0.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Internal", "Branch"],
    },
    {
        "id": "CUST-004",
        "code": "CUST-004",
        "customer_group_id": "CG-Franchises",
        "name": "Franchise - Mumbai Central",
        "mobile": "9922334455",
        "email": "mumbaifranchise@smriti.com",
        "outstanding": Decimal("120000.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Franchise", "Premium"],
    },
    {
        "id": "cust-rrl-192b561d",
        "code": "CUST-RRL-001",
        "customer_group_id": "CG-LargeRetail",
        "name": "Reliance Retail",
        "mobile": "9822334455",
        "email": "operations@relianceretail.com",
        "gst_number": "27AAACR1234F1Z1",
        "outstanding": Decimal("180000.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Wholesale", "Key-Account"],
    },
    {
        "id": "CUST-006",
        "code": "CUST-006",
        "customer_group_id": "CG-LargeRetail",
        "name": "Shoppers Stop",
        "mobile": "9833445566",
        "email": "billing@shoppersstop.com",
        "gst_number": "27AAACS4321E1Z2",
        "outstanding": Decimal("250000.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Key-Account"],
    },
    {
        "id": "CUST-007",
        "code": "CUST-007",
        "customer_group_id": "CG-LargeRetail",
        "name": "Lifestyle Stores",
        "mobile": "9844556677",
        "email": "accounts@lifestylestores.com",
        "gst_number": "27AAACL5678A1Z3",
        "outstanding": Decimal("320000.00"),
        "status": "Active",
        "created_date": date(2026, 7, 10),
        "tags": ["Wholesale"],
    }
]


async def seed_customers_and_groups():
    async with async_session() as db:
        # Check target company and branch
        comp_id = "COMP-001"
        branch_id = "BR-MAIN-001"

        # 1. Seed Customer Groups
        for g_data in CANONICAL_CUSTOMER_GROUPS:
            res = await db.execute(select(CustomerGroup).where(CustomerGroup.id == g_data["id"]))
            grp = res.scalars().first()
            if not grp:
                grp = CustomerGroup(
                    **g_data,
                    company_id=comp_id,
                    branch_id=branch_id,
                    is_active=True,
                    is_deleted=False,
                )
                db.add(grp)
            else:
                for k, v in g_data.items():
                    if k != "id":
                        setattr(grp, k, v)
                grp.company_id = comp_id
                grp.branch_id = branch_id
                grp.is_active = True
                grp.is_deleted = False

        await db.flush()

        # 2. Seed Customers
        for c_data in CANONICAL_CUSTOMERS:
            res = await db.execute(select(Customer).where(Customer.id == c_data["id"]))
            cust = res.scalars().first()
            if not cust:
                cust = Customer(
                    **c_data,
                    company_id=comp_id,
                    branch_id=branch_id,
                    is_active=True,
                    is_deleted=False,
                )
                db.add(cust)
            else:
                for k, v in c_data.items():
                    if k != "id":
                        setattr(cust, k, v)
                cust.company_id = comp_id
                cust.branch_id = branch_id
                cust.is_active = True
                cust.is_deleted = False

        await db.commit()
        print(f"SUCCESS: Seeded {len(CANONICAL_CUSTOMER_GROUPS)} Customer Groups and {len(CANONICAL_CUSTOMERS)} Canonical Customers into PostgreSQL!")


if __name__ == "__main__":
    asyncio.run(seed_customers_and_groups())
