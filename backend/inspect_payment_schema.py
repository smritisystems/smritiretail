import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur = conn.cursor()

# Get the schema for payment_transactions
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'payment_transactions'
    ORDER BY ordinal_position
""")

print("Payment Transactions Schema in smriti001:")
print("=" * 80)
for col_name, data_type, is_nullable, col_default in cur.fetchall():
    nullable = "NULL" if is_nullable == 'YES' else "NOT NULL"
    default_str = f" DEFAULT {col_default}" if col_default else ""
    print(f"  {col_name:25} {data_type:15} {nullable:9}{default_str}")

print("\n" + "=" * 80)
print("Foreign Keys on payment_transactions:")
print("=" * 80)

cur.execute("""
    SELECT 
        kcu.constraint_name,
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.constraint_column_usage ccu 
        ON kcu.constraint_name = ccu.constraint_name
    WHERE kcu.table_name = 'payment_transactions'
        AND kcu.constraint_name != 'payment_transactions_pkey'
""")

for constraint_name, column_name, foreign_table_name, foreign_column_name in cur.fetchall():
    print(f"  {column_name} -> {foreign_table_name}.{foreign_column_name}")

print("\n" + "=" * 80)
print("Indexes on payment_transactions:")
print("=" * 80)

cur.execute("""
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'payment_transactions'
    ORDER BY indexname
""")

for index_name, in cur.fetchall():
    print(f"  - {index_name}")

cur.close()
conn.close()
