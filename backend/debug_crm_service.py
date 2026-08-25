import asyncio
from app.db.session import async_session
from app.api.deps import TenantContext
from app.services.crm import CrmService

async def main():
    async with async_session() as db:
        ctx = TenantContext(company_id="COMP-001", branch_id="BR-MAIN-001", user_id="usr-manager-direct", roles=["MANAGER"])
        crm = CrmService(db, ctx)
        c = await crm.get_customer("CUST-001")
        print(f"Customer fetched: {c}")
        if c:
            print(f"  ID={c.id}, Name={c.name}, Company={c.company_id}, Branch={c.branch_id}")
        
        limit_ok = await crm.check_credit_limit("CUST-001", 1000.0)
        print(f"Credit limit check result: {limit_ok}")

if __name__ == "__main__":
    asyncio.run(main())
