"""
Database fix for Reliance parent-child billing relationships and visibility.
"""
import psycopg2

def main():
    conn = psycopg2.connect('postgresql://postgres:postgres@localhost:2781/smriti001')
    cur = conn.cursor()

    # 1. Update show_child_customers_in_billing = TRUE on parent accounts
    cur.execute("""
        UPDATE customers 
        SET show_child_customers_in_billing = TRUE 
        WHERE id IN ('CUST-001', 'cust-rrl-192b561d', 'cust-corp-parent-01')
    """)
    print("Updated show_child_customers_in_billing:", cur.rowcount)

    # 2. Ensure cust-ril-1888 is linked as child of cust-corp-parent-01 in customer_relationships
    cur.execute("""
        SELECT company_id, branch_id FROM customers WHERE id = 'cust-corp-parent-01'
    """)
    row = cur.fetchone()
    comp_id = row[0] if row else None
    br_id = row[1] if row else None

    cur.execute("""
        SELECT id FROM customer_relationships 
        WHERE parent_customer_id = 'cust-corp-parent-01' AND dependant_customer_id = 'cust-ril-1888'
    """)
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO customer_relationships (
                id, uuid, company_id, branch_id, created_at, modified_at,
                is_active, is_deleted, version, parent_customer_id, dependant_customer_id,
                relation, apply_same_mailing, notes
            ) VALUES (
                'cr-rrl-1888-parent', 'cr-rrl-1888-parent', %s, %s,
                NOW(), NOW(), TRUE, FALSE, 1, 'cust-corp-parent-01', 'cust-ril-1888',
                'Child Store', TRUE, 'Institutional child store account for Reliance Retail Ltd'
            )
        """, (comp_id, br_id))
        print("Inserted cr-rrl-1888-parent link")
    else:
        print("cr-rrl-1888-parent link already exists")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    main()
