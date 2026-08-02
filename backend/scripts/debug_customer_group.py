import asyncio
import uuid
from app.db.session import async_session
from app.models.tenant import Company, Branch
from app.services.crm import CrmService
from app.api.deps import TenantContext
from app.schemas.crm import CustomerGroupCreate

async def main():
    async with async_session() as s:
        c_id = f'comp-test-{uuid.uuid4().hex[:8]}'
        b_id = f'br-test-{uuid.uuid4().hex[:8]}'
        company = Company(id=c_id, name='Test Company', is_active=True)
        branch = Branch(id=b_id, company_id=c_id, name='Test Branch', code=f'BR-{c_id[-4:]}', is_active=True)
        s.add_all([company, branch])
        await s.commit()
        print('company/branch committed', c_id, b_id)
        cg_name = f'Test Group {uuid.uuid4().hex[:8]}'
        tenant = TenantContext(company_id=c_id, branch_id=b_id)
        crm = CrmService(s, tenant)
        try:
            cg = await crm.create_customer_group(CustomerGroupCreate(id=f'cg-{uuid.uuid4().hex[:8]}', name=cg_name, credit_limit=1000, auto_block_sales=True))
            print('created group', cg.id, cg.company_id, cg.branch_id)
        except Exception as e:
            import traceback
            print('error', type(e), e)
            traceback.print_exc()

asyncio.run(main())
