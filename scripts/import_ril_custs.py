"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import uuid
import asyncio
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
EXCEL_PATH = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\RIL FINAL LIST.xlsx"


async def import_ril_customers():
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: File not found at {EXCEL_PATH}")
        return

    df = pd.read_excel(EXCEL_PATH, sheet_name="Sheet1")
    # Drop rows without SITE NAME
    df = df.dropna(subset=["SITE NAME"]).copy()

    engine = create_async_engine(DB_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print(f"Processing {len(df)} RIL customer store records from Excel sheet...")

    async with async_session() as session:
        # Ensure company and branch seed records exist
        await session.execute(text("""
            INSERT INTO companies (id, uuid, name, is_active, is_deleted, created_at, modified_at)
            VALUES ('TATTLY', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tattly Threads', true, false, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
        """))
        await session.execute(text("""
            INSERT INTO branches (id, uuid, code, name, company_id, is_active, is_deleted, created_at, modified_at)
            VALUES ('MAIN', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'MAIN', 'Main Branch', 'TATTLY', true, false, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
        """))
        await session.commit()

        imported_count = 0

        for idx, row in df.iterrows():
            site_name = str(row["SITE NAME"]).strip()
            sis_code = str(row.get("SIS CODE") or "").strip()
            parent_code = str(row.get("Parent Code") or "").strip()
            code = sis_code if sis_code and sis_code != "nan" else (parent_code if parent_code and parent_code != "nan" else f"RIL-{idx+1:03d}")
            
            cust_id = f"cust-ril-{code.lower()}"
            cust_uuid = str(uuid.uuid4())

            state = str(row.get("STATE") or "").strip()
            city = str(row.get("CITY") or "").strip()
            pincode = str(row.get("PIN CODE") or "").strip()
            if pincode.endswith(".0"):
                pincode = pincode[:-2]
            
            address = str(row.get("ADDRESS") or "").strip()
            gst_no = str(row.get("GST NUMBER") or "").strip()
            if gst_no == "nan":
                gst_no = None

            full_address = address if address != "nan" else None
            clean_city = city if city != "nan" else None
            clean_state = state if state != "nan" else None
            clean_pincode = pincode if pincode != "nan" else None

            # Upsert Customer Record (Populating BOTH Billing and Shipping Addresses)
            await session.execute(text("""
                INSERT INTO customers (
                    id, uuid, code, name, gst_number, company_id, branch_id,
                    billing_address_line1, billing_city, billing_state, billing_pincode, billing_country,
                    shipping_same_as_billing, shipping_address_line1, shipping_city, shipping_state, shipping_pincode, shipping_country,
                    is_active, is_deleted, created_at, modified_at
                )
                VALUES (
                    :id, :uuid, :code, :name, :gst_number, 'TATTLY', 'MAIN',
                    :address, :city, :state, :pincode, 'India',
                    true, :address, :city, :state, :pincode, 'India',
                    true, false, NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    gst_number = EXCLUDED.gst_number,
                    billing_address_line1 = EXCLUDED.billing_address_line1,
                    billing_city = EXCLUDED.billing_city,
                    billing_state = EXCLUDED.billing_state,
                    billing_pincode = EXCLUDED.billing_pincode,
                    shipping_address_line1 = EXCLUDED.shipping_address_line1,
                    shipping_city = EXCLUDED.shipping_city,
                    shipping_state = EXCLUDED.shipping_state,
                    shipping_pincode = EXCLUDED.shipping_pincode,
                    modified_at = NOW();
            """), {
                "id": cust_id,
                "uuid": cust_uuid,
                "code": code,
                "name": site_name,
                "gst_number": gst_no,
                "address": full_address,
                "city": clean_city,
                "state": clean_state,
                "pincode": clean_pincode
            })

            imported_count += 1

        await session.commit()
        print(f"Successfully updated and synchronized {imported_count} RIL Customer Stores (with Billing & Shipping Addresses) into PostgreSQL database smritisys!")

if __name__ == "__main__":
    asyncio.run(import_ril_customers())
