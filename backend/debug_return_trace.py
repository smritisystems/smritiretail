import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.tests.conftest import clear_db, db_engine
from app.tests.test_sales_return_contracts import (
    _make_tenant, _make_cashier, _make_customer, _make_product, _make_invoice,
    _bearer, _set_tenant,
)
from app.db.ctrl_seeder import ControlPlaneSeeder
from app.models.inventory import Product, StockMovement


async def main():
    session_factory = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        await clear_db(session)
        await ControlPlaneSeeder.seed_governed_logic(session)
        await session.commit()

        s = uuid.uuid4().hex[:6]
        comp, br = await _make_tenant(session, s)
        cashier = await _make_cashier(session, s, comp.id, br.id)
        customer = await _make_customer(session, s, comp.id, br.id)
        product = await _make_product(session, s, comp.id, br.id, stock=5)
        invoice = await _make_invoice(session, s, comp.id, br.id, product.id, customer.id)
        _set_tenant(comp.id, br.id)
        headers = _bearer(cashier, comp.id, br.id)

        print('INITIAL_PRODUCT_STOCK', product.stock)
        payload = {
            'id': f'sr-inv-{s}',
            'return_no': f'RET-INV-{s}',
            'original_invoice_id': invoice.id,
            'items': [{
                'product_id': product.id,
                'code': product.code,
                'name': product.name,
                'quantity': '1.00',
                'price': '100.00',
                'gst_rate': '18.00',
                'total_amount': '118.00',
            }],
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            resp = await client.post('/api/v1/sales/returns/', json=payload, headers=headers)
            print('HTTP_STATUS', resp.status_code)
            print('HTTP_BODY', resp.text[:500])

        await session.refresh(product)
        print('AFTER_REFRESH_PRODUCT_STOCK', product.stock)

        rows = (await session.execute(select(StockMovement).where(StockMovement.reference_doc_id == payload['id']))).scalars().all()
        print('STOCK_MOVEMENT_ROW_COUNT', len(rows))
        for row in rows:
            print('MOVEMENT_ROW', {
                'id': row.id,
                'movement_type': row.movement_type,
                'quantity': str(row.quantity),
                'product_id': row.product_id,
                'reference_doc_id': row.reference_doc_id,
                'company_id': row.company_id,
                'branch_id': row.branch_id,
            })

        trigger_rows = await session.execute(text("SELECT tgname, tgenabled FROM pg_trigger WHERE tgname='trg_inventory_state_reconciliation'"))
        print('TRIGGERS', trigger_rows.fetchall())

        db_stock = await session.execute(text("SELECT stock FROM products WHERE id = :pid"), {'pid': product.id})
        print('DB_STOCK', db_stock.scalar_one())

asyncio.run(main())
