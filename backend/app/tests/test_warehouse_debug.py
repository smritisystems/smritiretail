import pytest
import uuid
from sqlalchemy import delete, select
from app.models.inventory import Warehouse
from app.models.tenant import Company, Branch
from app.services.inventory_warehouse_resolver import InventoryWarehouseResolver
from app.api.deps import get_db, get_company_db, get_tenant_context
from app.main import app
from app.tests.conftest import clear_db
from app.db.ctrl_seeder import ControlPlaneSeeder

pytestmark = pytest.mark.asyncio

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire test DB session into app dependencies."""
    await clear_db(db_session)
    await ControlPlaneSeeder.seed_governed_logic(db_session)
    await db_session.commit()

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db

async def _make_tenant_local(db_session, suffix: str):
    """Local version of _make_tenant for this test."""
    uid = uuid.uuid4().hex[:6]
    tenant_id = f"{suffix}-{uid}"
    company = Company(
        id=f"comp-sal-{tenant_id}", name=f"Sales Co {tenant_id}",
        gst_number="27ABCDE1234F1Z5", is_active=True,
    )
    branch = Branch(
        id=f"br-sal-{tenant_id}", company_id=company.id,
        name=f"Sales Br {tenant_id}", code=f"BRSAL-{tenant_id}", is_active=True,
    )
    db_session.add(company)
    await db_session.flush()
    db_session.add(branch)
    await db_session.flush()
    # Make warehouse ID unique using the full unique tenant_id
    from app.models.inventory import Warehouse
    warehouse = Warehouse(
        id=f"wh-central-{tenant_id}", company_id=company.id, branch_id=branch.id,
        code=f"WH-SAL-{tenant_id}", name="Central Warehouse", is_active=True,
    )
    db_session.add(warehouse)
    await db_session.commit()
    return company, branch

async def test_warehouse_missing_debug(db_session, override_db_and_tenant):
    """Debug test to see what's happening with warehouse resolution."""
    company, branch = await _make_tenant_local(db_session, "dbg_whmissing")
    
    # Query warehouses before deletion
    stmt_before = select(Warehouse)
    result_before = await db_session.execute(stmt_before)
    warehouses_before = result_before.scalars().all()
    print(f"\n[DEBUG] Before delete: {len(warehouses_before)} warehouses total")
    for wh in warehouses_before:
        print(f"  - {wh.id}, company_id={wh.company_id}, branch_id={wh.branch_id}, is_deleted={wh.is_deleted}, is_active={wh.is_active}")
    
    # Delete warehouses for this company
    stmt_delete = delete(Warehouse).where(Warehouse.company_id == company.id)
    result_del = await db_session.execute(stmt_delete)
    print(f"\n[DEBUG] Deleted {result_del.rowcount} warehouses for company {company.id}")
    await db_session.commit()
    
    # Query again to confirm deletion
    stmt_after = select(Warehouse)
    result_after = await db_session.execute(stmt_after)
    warehouses_after = result_after.scalars().all()
    print(f"\n[DEBUG] After delete: {len(warehouses_after)} warehouses total")
    for wh in warehouses_after:
        print(f"  - {wh.id}, company_id={wh.company_id}, branch_id={wh.branch_id}, is_deleted={wh.is_deleted}, is_active={wh.is_active}")
    
    # Try to resolve
    resolver = InventoryWarehouseResolver(db_session)
    try:
        result = await resolver.resolve(company_id=company.id, branch_id=branch.id)
        print(f"\n[DEBUG] Resolver returned warehouse: {result.id}, company_id={result.company_id}")
        assert False, f"Expected ValueError but got warehouse {result.id}"
    except ValueError as e:
        print(f"\n[DEBUG] Resolver raised ValueError as expected: {e}")
        assert str(e) == "INVENTORY_WAREHOUSE_NOT_CONFIGURED"
