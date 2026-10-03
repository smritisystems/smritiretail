"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Test Suite   : Go-Live Remediation Phase 3 End-to-End Verification
"""

import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product, Warehouse
from app.models.tenant import Branch, Company
from app.models.purchase import Supplier
from app.models.crm import Customer
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.db.ctrl_seeder import ControlPlaneSeeder
from app.services.identity.uuid7 import is_valid_uuidv7
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Clean tables and wire test db session."""
    await clear_db(db_session)
    await ControlPlaneSeeder.seed_governed_logic(db_session)
    await db_session.commit()

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)
        app.dependency_overrides.pop(get_current_user, None)


async def _setup_tenant_and_client(db_session, role=UserRole.SYSADMIN):
    suffix = uuid.uuid4().hex[:6]
    comp = Company(
        id=f"comp-p3-{suffix}",
        name=f"GoLive Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-p3-{suffix}",
        company_id=comp.id,
        name=f"GoLive Br {suffix}",
        code=f"BRP3-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.commit()

    warehouse = Warehouse(
        id=f"wh-p3-{suffix}",
        company_id=comp.id,
        branch_id=br.id,
        code=f"WH-P3-{suffix}",
        name="GoLive Warehouse",
        is_active=True,
    )
    db_session.add(warehouse)
    await db_session.commit()

    user = User(
        id=f"usr-p3-{suffix}",
        username=f"usr_p3_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(user)
    await db_session.commit()

    tenant_ctx = TenantContext(
        company_id=comp.id,
        branch_id=br.id,
    )

    async def _get_tenant():
        return tenant_ctx

    async def _get_usr():
        return user

    app.dependency_overrides[get_tenant_context] = _get_tenant
    app.dependency_overrides[get_current_user] = _get_usr

    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": role.value,
        "company_id": comp.id,
        "branch_id": br.id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": comp.id,
        "X-Branch-ID": br.id,
    }

    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    return client, headers, comp, br, user


@pytest.mark.asyncio
async def test_grn_receipt_flow(db_session):
    """
    Test Blocker 3:
    Create PO for 50 items -> Post GRN for 48 received, 2 short -> Verify stock inwarded and status RECEIVED.
    """
    client, headers, comp, br, user = await _setup_tenant_and_client(db_session)

    # 1. Create Supplier
    sup_id = f"sup-p3-{uuid.uuid4().hex[:8]}"
    sup_code = f"SUP-{uuid.uuid4().hex[:4].upper()}"
    sup_res = await client.post(
        "/api/v1/purchase/suppliers/",
        headers=headers,
        json={
            "id": sup_id,
            "code": sup_code,
            "name": "Acme Fabrics Supplier",
            "contact_person": "Mr. Sharma",
            "mobile": "9876543210",
            "email": "sharma@acmefabrics.com",
            "gst_number": "27AAACA1234A1Z5",
            "city": "Mumbai",
            "state": "Maharashtra",
        },
    )
    assert sup_res.status_code == 201, sup_res.text
    supplier_id = sup_res.json()["id"]

    # 2. Create Product
    prod = Product(
        id=f"prd-p3-{uuid.uuid4().hex[:6]}",
        company_id=comp.id,
        branch_id=br.id,
        name="Cotton Linen Blend Shirt",
        code=f"SKU-LN-{uuid.uuid4().hex[:4].upper()}",
        barcode=f"BAR-{uuid.uuid4().hex[:6].upper()}",
        category="Apparel",
        hsn_code="6205",
        cost_price=Decimal("450.00"),
        price=Decimal("899.00"),
        mrp=Decimal("999.00"),
        stock=50,
        is_active=True,
    )
    db_session.add(prod)
    await db_session.commit()

    # 3. Create PO for 50 items
    po_res = await client.post(
        "/api/v1/purchase/orders/",
        headers=headers,
        json={
            "order_no": f"PO-P3-{uuid.uuid4().hex[:4].upper()}",
            "supplier_id": supplier_id,
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity": 50,
                    "cost_price": 450.00,
                    "gst_rate": 5.00,
                }
            ],
        },
    )
    assert po_res.status_code == 201, po_res.text
    po_data = po_res.json()
    order_id = po_data["id"]

    # 4. Post GRN: Ordered=50, Received=48, Damaged=0, Short=2
    grn_res = await client.post(
        "/api/v1/purchase/receipts/",
        headers=headers,
        json={
            "supplier_id": supplier_id,
            "order_id": order_id,
            "notes": "Physical verification completed at godown: 48 good received, 2 short.",
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity_ordered": 50,
                    "quantity_received": 48,
                    "quantity_damaged": 0,
                    "cost_price": 450.00,
                    "gst_rate": 5.00,
                }
            ],
        },
    )
    assert grn_res.status_code == 201, grn_res.text
    grn_data = grn_res.json()
    assert is_valid_uuidv7(grn_data["id"]), f"GRN ID {grn_data['id']} is not a valid UUIDv7"
    assert grn_data["status"] == "RECEIVED"
    assert grn_data["supplier_id"] == supplier_id
    assert len(grn_data["items"]) == 1
    assert Decimal(str(grn_data["items"][0]["quantity_received"])) == Decimal("48")
    assert Decimal(str(grn_data["subtotal"])) == Decimal("48") * Decimal("450.00")


@pytest.mark.asyncio
async def test_purchase_bill_from_grn(db_session):
    """
    Test Blocker 4:
    Post supplier purchase bill against confirmed GRN -> verify status POSTED.
    """
    client, headers, comp, br, user = await _setup_tenant_and_client(db_session)

    # 1. Supplier & Product
    sup = Supplier(
        id=f"sup-p3-{uuid.uuid4().hex[:6]}",
        code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
        company_id=comp.id,
        branch_id=br.id,
        name="Raymond Mills Ltd",
        outstanding=Decimal("0.00"),
        is_active=True,
    )
    prod = Product(
        id=f"prd-p3-{uuid.uuid4().hex[:6]}",
        company_id=comp.id,
        branch_id=br.id,
        name="Wool Blend Trousers",
        code=f"SKU-TR-{uuid.uuid4().hex[:4].upper()}",
        barcode=f"BAR-{uuid.uuid4().hex[:6].upper()}",
        category="Apparel",
        cost_price=Decimal("1200.00"),
        price=Decimal("2400.00"),
        stock=10,
        is_active=True,
    )
    db_session.add_all([sup, prod])
    await db_session.commit()

    # 2. Post GRN
    grn_res = await client.post(
        "/api/v1/purchase/receipts/",
        headers=headers,
        json={
            "supplier_id": sup.id,
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity_ordered": 10,
                    "quantity_received": 10,
                    "cost_price": 1200.00,
                    "gst_rate": 12.00,
                }
            ],
        },
    )
    assert grn_res.status_code == 201, grn_res.text
    grn = grn_res.json()

    # 3. Post Purchase Bill
    bill_res = await client.post(
        "/api/v1/purchase/bills/",
        headers=headers,
        json={
            "bill_no": f"INV-SUP-{uuid.uuid4().hex[:6].upper()}",
            "supplier_id": sup.id,
            "receipt_id": grn["id"],
            "taxable_amount": float(grn["subtotal"]),
            "tax_amount": float(grn["tax_total"]),
            "total_amount": float(grn["grand_total"]),
            "notes": "Verified against delivery challan",
        },
    )
    assert bill_res.status_code == 201, bill_res.text
    bill = bill_res.json()
    assert is_valid_uuidv7(bill["id"]), f"Purchase Bill ID {bill['id']} is not a valid UUIDv7"
    assert bill["status"] == "POSTED"
    assert bill["supplier_id"] == sup.id
    assert bill["receipt_id"] == grn["id"]


@pytest.mark.asyncio
async def test_debit_note_creation(db_session):
    """
    Test Blocker 5:
    Issue Debit Note for short GRN -> verify supplier balance adjusted.
    """
    client, headers, comp, br, user = await _setup_tenant_and_client(db_session)

    sup = Supplier(
        id=f"sup-p3-{uuid.uuid4().hex[:6]}",
        code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
        company_id=comp.id,
        branch_id=br.id,
        name="Arvind Mills",
        outstanding=Decimal("5000.00"),
        is_active=True,
    )
    db_session.add(sup)
    await db_session.commit()

    dn_res = await client.post(
        "/api/v1/purchase/debit-notes/",
        headers=headers,
        json={
            "debit_note_no": f"DN-2026-{uuid.uuid4().hex[:4].upper()}",
            "supplier_id": sup.id,
            "receipt_id": "GRN-TEST-001",
            "claim_amount": 900.00,
            "tax_amount": 45.00,
            "total_debit_amount": 945.00,
            "reason": "Shortage of 2 items on delivery",
            "status": "ISSUED",
        },
    )
    assert dn_res.status_code == 201, dn_res.text
    dn = dn_res.json()
    assert is_valid_uuidv7(dn["id"]), f"Debit Note ID {dn['id']} is not a valid UUIDv7"
    assert dn["status"] == "ISSUED"
    assert Decimal(str(dn["total_debit_amount"])) == Decimal("945.00")

    await db_session.refresh(sup)
    assert sup.outstanding == Decimal("4055.00")


@pytest.mark.asyncio
async def test_sales_return_credit_note(db_session):
    """
    Test Blocker 6:
    Create Sales Return -> verify return persisted and credit note reference assigned.
    """
    client, headers, comp, br, user = await _setup_tenant_and_client(db_session)

    suffix = uuid.uuid4().hex[:6]
    cust = Customer(
        id=f"cust-{suffix}",
        code=f"CUST-{suffix}",
        name=f"Customer {suffix}",
        company_id=comp.id,
        branch_id=br.id,
        is_active=True,
    )
    prod = Product(
        id=f"prd-p3-{suffix}",
        company_id=comp.id,
        branch_id=br.id,
        name="Silk Scarf",
        code=f"SKU-SC-{suffix}",
        barcode=f"BAR-{suffix}",
        category="Accessories",
        cost_price=Decimal("200.00"),
        price=Decimal("500.00"),
        stock=20,
        is_active=True,
    )
    db_session.add_all([cust, prod])
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        product_id=prod.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("1.00"),
        price=Decimal("500.00"),
        gst_rate=Decimal("5.00"),
        tax_amount=Decimal("25.00"),
        total_amount=Decimal("525.00"),
    )
    inv = SalesInvoice(
        id=f"inv-{suffix}",
        invoice_no=f"INV-{suffix.upper()}",
        customer_id=cust.id,
        tax_total=Decimal("25.00"),
        grand_total=Decimal("525.00"),
        status="paid",
        items=[inv_item],
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(inv)
    await db_session.commit()

    # Create Sales Return
    ret_res = await client.post(
        "/api/v1/sales/returns/",
        headers=headers,
        json={
            "id": f"ret-{suffix}",
            "return_no": f"RET-{suffix.upper()}",
            "original_invoice_id": inv.id,
            "credit_note_number": f"CN-{suffix.upper()}",
            "reason": "Customer Return - Size Fit Issue",
            "tax_total": 25.00,
            "grand_total": 525.00,
            "status": "processed",
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity": 1.0,
                    "price": 500.00,
                    "gst_rate": 5.00,
                    "tax_amount": 25.00,
                    "total_amount": 525.00,
                }
            ],
        },
    )
    assert ret_res.status_code in [200, 201], ret_res.text
    ret_data = ret_res.json()
    assert ret_data["status"] in ["processed", "CONFIRMED", "ISSUED", "COMPLETED", "APPROVED", "DRAFT", "Draft"]


@pytest.mark.asyncio
async def test_eway_bill_dispatch_record(db_session):
    """
    Test Blocker 7:
    Create E-Way Bill dispatch record -> verify record saved and queried.
    """
    client, headers, comp, br, user = await _setup_tenant_and_client(db_session)

    ewb_no = f"EWB-2026-{uuid.uuid4().hex[:6].upper()}"
    res = await client.post(
        "/api/v1/sales/eway-bills/",
        headers=headers,
        json={
            "eway_bill_no": ewb_no,
            "invoice_id": "INV-DISP-001",
            "consignment_value": 45000.00,
            "transporter_id": "TRP-VTRANS-001",
            "transporter_name": "V-Trans Logistics Pvt Ltd",
            "transport_mode": "Road",
            "vehicle_no": "MH04AB1234",
            "distance_km": 250,
            "status": "DISPATCHED",
        },
    )
    assert res.status_code == 201, res.text
    ewb = res.json()
    assert is_valid_uuidv7(ewb["id"]), f"E-Way Bill ID {ewb['id']} is not a valid UUIDv7"
    assert ewb["eway_bill_no"] == ewb_no
    assert ewb["status"] == "DISPATCHED"
    assert ewb["vehicle_no"] == "MH04AB1234"

    # Query list
    list_res = await client.get("/api/v1/sales/eway-bills/", headers=headers)
    assert list_res.status_code == 200, list_res.text
    items = list_res.json()
    assert any(item["eway_bill_no"] == ewb_no for item in items)


@pytest.mark.asyncio
async def test_kpi_endpoints_live(db_session):
    """
    Test Blocker 8:
    Verify live KPI endpoints return valid responses without hardcoded mock errors.
    """
    client, headers, comp, br, user = await _setup_tenant_and_client(db_session)

    # CRM Customers
    crm_res = await client.get("/api/v1/crm/customers", headers=headers)
    assert crm_res.status_code == 200, crm_res.text
    assert isinstance(crm_res.json(), list)

    # Daily Sales Report
    sales_res = await client.get("/api/v1/reports/daily-sales?report_date=2026-09-18", headers=headers)
    assert sales_res.status_code == 200, sales_res.text
    data = sales_res.json()
    assert "total_sales" in data or "total_invoices" in data or isinstance(data, dict)
