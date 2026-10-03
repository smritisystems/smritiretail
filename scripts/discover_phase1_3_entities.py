"""
Comprehensive Phase 1.3 Discovery Script
Inspects:
- External parties: parties
- Payment & Transactions: payment_transactions, pos_payments, payments
- Statutory & Compliance: eway_bills, einvoices, e_way_bills, e_invoices
- Existing Aliases: smriti_identity_alias
- Associated Models & Routers
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASES = [
    ("smritisys", "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"),
    ("smriti001", "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"),
    ("smriti002", "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti002"),
]

CANDIDATES = [
    "parties",
    "payment_transactions",
    "pos_payments",
    "payments",
    "eway_bills",
    "einvoices",
    "e_way_bills",
    "e_invoices",
    "compliance_records",
    "gst_returns",
    "smriti_identity_alias",
]

async def audit():
    for name, url in DATABASES:
        print(f"\n{'='*70}\nDATABASE: {name}\n{'='*70}")
        try:
            engine = create_async_engine(url, echo=False)
            async with engine.connect() as conn:
                for t in CANDIDATES:
                    # Check existence
                    exists_q = text("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = :tbl
                        );
                    """)
                    exists = (await conn.execute(exists_q, {"tbl": t})).scalar()
                    if not exists:
                        print(f"  {t:<25} : [DOES NOT EXIST]")
                        continue
                    
                    # Count
                    cnt = (await conn.execute(text(f'SELECT COUNT(*) FROM "{t}"'))).scalar()
                    
                    # Columns and PK
                    pk_q = text("""
                        SELECT kcu.column_name, c.data_type, c.character_maximum_length, c.is_nullable
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                          ON tc.constraint_name = kcu.constraint_name
                        JOIN information_schema.columns c
                          ON c.table_name = tc.table_name AND c.column_name = kcu.column_name
                        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = :tbl
                    """)
                    pks = (await conn.execute(pk_q, {"tbl": t})).fetchall()
                    pk_str = ", ".join([f"{p[0]} ({p[1]})" for p in pks])
                    
                    # Check if identity_code exists
                    has_id_code = (await conn.execute(text("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = :tbl AND column_name = 'identity_code'
                        );
                    """), {"tbl": t})).scalar()
                    
                    # Sample values
                    sample_str = "None"
                    if cnt > 0:
                        s_q = text(f'SELECT * FROM "{t}" LIMIT 1')
                        sample = (await conn.execute(s_q)).mappings().first()
                        sample_str = str(dict(sample))[:120] + "..." if sample else "None"
                        
                    print(f"  {t:<25} : rows={cnt:<6} | PK=[{pk_str}] | has_identity_code={has_id_code}")
                    if cnt > 0:
                        print(f"    sample: {sample_str}")
            await engine.dispose()
        except Exception as e:
            print(f"  Failed to connect to {name}: {e}")

if __name__ == "__main__":
    asyncio.run(audit())
