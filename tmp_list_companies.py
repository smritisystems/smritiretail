import sys
from pathlib import Path
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root / "backend"))

import asyncio
from sqlalchemy import select
from app.db.session import async_session, active_tenant_ctx, active_security_context
from app.models.tenant import Company

async def main():
    async with async_session() as session:
        active_tenant_ctx.set(None)
        active_security_context.set(None)
        res = await session.execute(select(Company).order_by(Company.name))
        companies = res.scalars().all()
        if not companies:
            print('NO_COMPANIES')
            return
        for c in companies:
            print(f"{c.id}\t{c.name}\t{c.gst_number or ''}\t{c.company_code or ''}")

if __name__ == '__main__':
    asyncio.run(main())
