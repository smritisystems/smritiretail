"""Debug test for stock increment issue."""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.crm import Customer, CustomerGroup
from app.api.deps import get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio

@pytest.fixture(autouse=True)
async def override_tenant_context_only(db_session):
    """Override only the tenant context, rely on auto_override_company_db for DB overrides."""
    async def _get_tenant_ctx():
        # This will be updated per-test
        return TenantContext(company_id="placeholder", branch_id="placeholder")
    app.dependency_overrides[get_tenant_context] = _get_tenant_ctx
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_tenant_context, None)

async def test_stock_debug(db_session):
    """Debug stock increment."""
    suffix = uuid.uuid4().hex[:12]  # Make suffix longer and more unique
    
    # Create company and branch
    company = Company(id=f"comp-{suffix}", name=f"Co {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    branch = Branch(id=f"br-{suffix}", company_id=company.id, name=f"Br {suffix}", code=f"BR-{suffix}", is_active=True)
    db_session.add(company)
    await db_session.flush()
    db_session.add(branch)
    await db_session.flush()
    
    warehouse = Warehouse(id=f"wh-{suffix}", company_id=company.id, branch_id=branch.id, code=f"WH-{suffix}", name="WH", is_active=True)
    db_session.add(warehouse)
    await db_session.commit()
    
    # Create customer
    cgroup = CustomerGroup(id=f"cg-{suffix}", name=f"CG {suffix}", credit_limit=Decimal("50000"), company_id=company.id, branch_id=branch.id)
    db_session.add(cgroup)
    await db_session.flush()
    
    customer = Customer(id=f"cust-{suffix}", code=f"CUST-{suffix}", customer_group_id=cgroup.id, name=f"Cust {suffix}", company_id=company.id, branch_id=branch.id)
    db_session.add(customer)
    await db_session.commit()
    
    # Create product with stock=5
    product = Product(
        id=f"prod-{suffix}",
        code=f"PROD-{suffix}",
        name=f"Product {suffix}",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        gst_percentage=Decimal("18.00"),
        hsn_code="6403",
        category="General",
        barcode=f"BAR-{suffix}",
        stock=5,
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add(product)
    await db_session.commit()
    
    print(f"[DEBUG] Product created: id={product.id}, stock={product.stock}")
    
    # Create invoice with 1 item qty=1
    item = SalesInvoiceItem(
        product_id=product.id,
        code=f"PSAL-{suffix}",
        name=f"Sales Product {suffix}",
        quantity=Decimal("1.00"),
        price=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        tax_amount=Decimal("18.00"),
        total_amount=Decimal("118.00"),
    )
    invoice = SalesInvoice(
        id=f"inv-{suffix}",
        invoice_no=f"INV-{suffix}",
        customer_id=customer.id,
        tax_total=Decimal("18.00"),
        grand_total=Decimal("118.00"),
        status="paid",
        items=[item],
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add(invoice)
    await db_session.commit()
    
    print(f"[DEBUG] Invoice created: id={invoice.id}, items={len(invoice.items)}")
    
    # Create user and bearer token
    user = User(
        id=f"usr-{suffix}",
        username=f"usr_{suffix}",
        hashed_password=hash_password("Pass@123"),
        role=UserRole.CASHIER,
        company_id=company.id,
        branch_id=branch.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(user)
    await db_session.commit()
    
    # Set tenant context to match company and branch
    async def _get_tenant():
        return TenantContext(company_id=company.id, branch_id=branch.id)
    app.dependency_overrides[get_tenant_context] = _get_tenant
    
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": company.id,
        "branch_id": branch.id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    headers = {"Authorization": f"Bearer {token}"}
    
    # Call return API
    payload = {
        "id": f"ret-{suffix}",
        "return_no": f"RET-{suffix}",
        "original_invoice_id": invoice.id,
        "reason": "Debug test",
        "status": "processed",
        "items": [
            {
                "product_id": product.id,
                "code": product.code,
                "name": product.name,
                "quantity": "1.00",
                "price": "100.00",
                "gst_rate": "18.00",
                "total_amount": "118.00",
            }
        ],
    }
    
    print(f"[DEBUG] Before API call: db_session stock={product.stock}")
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sales/returns/", json=payload, headers=headers)
    
    print(f"[DEBUG] API response status: {resp.status_code}")
    print(f"[DEBUG] After API call (before refresh): product.stock={product.stock}")
    
    if resp.status_code != 201:
        print(f"[DEBUG] API response: {resp.text}")
    
    # Refresh product from database
    await db_session.refresh(product)
    print(f"[DEBUG] After API call (after refresh): product.stock={product.stock}")
    
    # Query all StockMovements for this product
    stmt = select(StockMovement).where(StockMovement.product_id == product.id)
    result = await db_session.execute(stmt)
    movements = result.scalars().all()
    print(f"[DEBUG] StockMovements for product: count={len(movements)}")
    for move in movements:
        print(f"  - id={move.id}, qty={move.quantity}, type={move.movement_type}, ref={move.reference_doc_id}")
    
    # Query the database directly to see what stock value is really there
    direct_stmt = select(Product).where(Product.id == product.id)
    direct_result = await db_session.execute(direct_stmt)
    direct_product = direct_result.scalars().first()
    print(f"[DEBUG] Direct DB query: stock={direct_product.stock}")
    
    # Check what stock should be
    assert product.stock == 6, f"Expected stock=6, got stock={product.stock}"
