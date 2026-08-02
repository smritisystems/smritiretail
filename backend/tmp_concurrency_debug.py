import asyncio
from decimal import Decimal
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.api.deps import TenantContext
from app.models.inventory import Product
from app.services.inventory_reservation import InventoryReservationService

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    row_lock_statements = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        if 'FOR UPDATE' in statement.upper():
            row_lock_statements.append(statement)

    event.listen(engine.sync_engine, 'before_cursor_execute', capture)

    async with async_session() as session:
        await session.execute(text('TRUNCATE TABLE stock_movements, products, companies, branches RESTART IDENTITY CASCADE'))
        await session.execute(text("INSERT INTO companies (id, uuid, name, gst_number, is_active, is_deleted, created_at, modified_at) VALUES ('comp-test', gen_random_uuid()::text, 'Test Company', '27ABCDE1234F1Z5', true, false, now(), now())"))
        await session.execute(text("INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at) VALUES ('br-test', gen_random_uuid()::text, 'comp-test', 'Test Branch', 'BR-TEST', true, false, now(), now())"))
        await session.commit()
        prod = Product(
            id='prod-test',
            code='PROD-TEST',
            name='Proto',
            price=10,
            stock=10,
            category='General',
            barcode='TEST-0001',
            company_id='comp-test',
            branch_id='br-test',
        )
        session.add(prod)
        await session.commit()

    tenant_ctx = TenantContext(company_id='comp-test', branch_id='br-test')

    async def reserve(res_id):
        async with async_session() as session:
            service = InventoryReservationService(session, tenant_ctx)
            print(f'[{res_id}] start')
            try:
                result = await service.reserve('prod-test', 10, 'SO', res_id)
                print(f'[{res_id}] success {result}')
                return result
            except Exception as exc:
                print(f'[{res_id}] fail {type(exc).__name__}: {exc}')
                return exc

    results = await asyncio.gather(reserve('SO-TEST-0'), reserve('SO-TEST-1'))
    print('row_lock_statements count:', len(row_lock_statements))
    for idx, stmt in enumerate(row_lock_statements):
        print(f'FOR UPDATE #{idx}: {stmt}')
    print('results:', results)

    async with async_session() as session:
        reserved = await session.execute(text("SELECT reserved_stock FROM products WHERE id='prod-test'"))
        count = await session.execute(text("SELECT COUNT(*) FROM stock_movements WHERE product_id='prod-test'"))
        print('final reserved_stock:', reserved.scalar())
        print('final movement_count:', count.scalar())

    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
