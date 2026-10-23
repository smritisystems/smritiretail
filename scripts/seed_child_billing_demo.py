"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.13
Created      : 2026-10-23
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Demo & Seeding Runner for Child Customer Billing
"""

import asyncio
import uuid
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:2781/smriti001')
    
    parent_id = 'cust-corp-parent-01'
    child_id = 'cust-bnd-child-01'
    
    # 1. Upsert Parent
    p_exists = await conn.fetchval("SELECT id FROM customers WHERE id = $1", parent_id)
    if not p_exists:
        await conn.execute("""
            INSERT INTO customers (
                id, uuid, code, name, mobile, email, status, is_active, is_deleted,
                show_child_customers_in_billing, company_id
            ) VALUES (
                $1, $2, 'RRL-CORP-PARENT', 'Reliance Retail Corporate (Parent)',
                '9820011001', 'corp@reliance.com', 'Active', true, false, true, 'COMP-001'
            )
        """, parent_id, str(uuid.uuid4()))
    else:
        await conn.execute("""
            UPDATE customers
            SET show_child_customers_in_billing = true, is_deleted = false, is_active = true
            WHERE id = $1
        """, parent_id)
        
    # 2. Upsert Child
    c_exists = await conn.fetchval("SELECT id FROM customers WHERE id = $1", child_id)
    if not c_exists:
        await conn.execute("""
            INSERT INTO customers (
                id, uuid, code, name, mobile, email, status, is_active, is_deleted,
                is_dependant, company_id
            ) VALUES (
                $1, $2, 'RRL-BND-CHILD', 'Reliance Fresh - Bandra West (Child Outlet)',
                '9820011002', 'bandra@reliance.com', 'Active', true, false, true, 'COMP-001'
            )
        """, child_id, str(uuid.uuid4()))
    else:
        await conn.execute("""
            UPDATE customers
            SET is_dependant = true, is_deleted = false, is_active = true
            WHERE id = $1
        """, child_id)
        
    # 3. Upsert Relationship
    r_exists = await conn.fetchval("SELECT id FROM customer_relationships WHERE id = 'rel-rrl-bnd-01'")
    if not r_exists:
        await conn.execute("""
            INSERT INTO customer_relationships (
                id, parent_customer_id, dependant_customer_id, relation, company_id, is_active, is_deleted
            ) VALUES (
                'rel-rrl-bnd-01', $1, $2, 'Branch', 'COMP-001', true, false
            )
        """, parent_id, child_id)
    else:
        await conn.execute("""
            UPDATE customer_relationships
            SET is_active = true, is_deleted = false, parent_customer_id = $1, dependant_customer_id = $2
            WHERE id = 'rel-rrl-bnd-01'
        """, parent_id, child_id)
        
    print("Seed complete: Parent 'Reliance Retail Corporate (Parent)' and Child 'Reliance Fresh - Bandra West (Child Outlet)' ready!")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
