"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.40.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Test Suite   : Identity Governance Remediation AST & Runtime Verification Battery
"""

import ast
import os
import re
import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product, Warehouse
from app.models.tenant import Branch, Company
from app.models.purchase import Supplier, PurchaseOrder, PurchaseReceiptItem
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn
from app.models.distribution import EWayBill
from app.models.identity_registry import SmritiIdentityAlias
from app.services.identity.uuid7 import is_valid_uuidv7
from app.services.purchase import PurchaseService
from app.schemas.purchase import PurchaseReceiptCreate, PurchaseReceiptItemCreate, DebitNoteCreate, PurchaseBillCreate
from app.db.ctrl_seeder import ControlPlaneSeeder
from app.tests.conftest import clear_db


# =============================================================================
# PART 1: Hard Static AST Inspection — Prohibiting Local ID Generation
# =============================================================================

def test_ast_scan_forbidden_persistent_id_generators():
    """
    Scans PurchaseService, SalesService, and sales API endpoints using Python AST.
    Asserts zero usage of local UUIDv4 generators (_uid, uuid.uuid4) for persistent ID generation.
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_files = [
        os.path.join(backend_dir, "services", "purchase.py"),
        os.path.join(backend_dir, "services", "sales.py"),
        os.path.join(backend_dir, "services", "canonical_sales_writer.py"),
        os.path.join(backend_dir, "services", "sales_ledger_svc.py"),
        os.path.join(backend_dir, "services", "inventory_wms.py"),
        os.path.join(backend_dir, "services", "univ_party_svc.py"),
        os.path.join(backend_dir, "services", "crm.py"),
        os.path.join(backend_dir, "api", "v1", "sales.py"),
    ]

    for file_path in target_files:
        assert os.path.exists(file_path), f"File {file_path} not found"
        with open(file_path, "r", encoding="utf-8-sig") as f:
            source = f.read()

        tree = ast.parse(source, filename=file_path)

        # 1. Prohibit any definition of `def _uid()`
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "_uid":
                pytest.fail(f"FORBIDDEN: Found local '_uid' definition in {file_path}:{node.lineno}")

        # 2. Check targeted transactional creation methods for forbidden uuid.uuid4() calls
        creation_functions = {
            "create_purchase_receipt",
            "create_debit_note",
            "create_purchase_bill",
            "create_purchase_order",
            "create_from_reorder_trigger",
            "amend_purchase_order",
            "create_eway_bill",
            "create_sales_return",
            "convert_order_to_invoice",
            "convert_quotation_to_invoice",
            "post_sales_invoice",
            "create_party",
            "converge_customer_to_party",
            "converge_supplier_to_party",
            "create_customer",
            "atomic_mutate_batch_stock",
            "create_stock_transfer",
        }

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in creation_functions:
                for child in ast.walk(node):
                    if isinstance(child, ast.Call):
                        # Detect calls to uuid.uuid4()
                        if isinstance(child.func, ast.Attribute) and child.func.attr == "uuid4":
                            pytest.fail(
                                f"FORBIDDEN: Found uuid.uuid4() inside {node.name} at {file_path}:{child.lineno}. "
                                f"Persistent IDs must be generated via IdentityEngine."
                            )
                        # Detect calls to _uid()
                        if isinstance(child.func, ast.Name) and child.func.id == "_uid":
                            pytest.fail(
                                f"FORBIDDEN: Found _uid() call inside {node.name} at {file_path}:{child.lineno}."
                            )


# =============================================================================
# PART 2: Runtime Verification Battery
# =============================================================================

@pytest.fixture(autouse=True)
async def setup_test_db(db_session):
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


async def _setup_tenant(db_session):
    suffix = uuid.uuid4().hex[:6]
    comp = Company(
        id=f"comp-gov-{suffix}",
        name=f"Gov Company {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-gov-{suffix}",
        company_id=comp.id,
        name=f"Gov Branch {suffix}",
        code=f"BRG-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.commit()

    wh = Warehouse(
        id=f"wh-gov-{suffix}",
        company_id=comp.id,
        branch_id=br.id,
        code=f"WHG-{suffix}",
        name="Gov Warehouse",
        is_active=True,
    )
    db_session.add(wh)
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=br.id)
    return tenant_ctx, comp, br, wh


@pytest.mark.asyncio
async def test_grn_identity_engine_governance(db_session):
    """
    Verify PurchaseReceipt and PurchaseReceiptItem allocate valid UUIDv7 IDs
    and governed PUR-GRN-XXXXXXXX identity codes via IdentityEngine.
    """
    tenant_ctx, comp, br, wh = await _setup_tenant(db_session)
    service = PurchaseService(db_session, tenant_ctx)

    # 1. Setup Supplier & Product
    sup = Supplier(
        id=f"sup-gov-{uuid.uuid4().hex[:6]}",
        code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
        company_id=comp.id,
        branch_id=br.id,
        name="Gov Supplier",
        outstanding=Decimal("0.00"),
        is_active=True,
    )
    prod = Product(
        id=f"prd-gov-{uuid.uuid4().hex[:6]}",
        company_id=comp.id,
        branch_id=br.id,
        name="Linen Fabric",
        code=f"SKU-LN-{uuid.uuid4().hex[:4].upper()}",
        barcode=f"BAR-{uuid.uuid4().hex[:6].upper()}",
        category="Apparel",
        cost_price=Decimal("300.00"),
        price=Decimal("600.00"),
        stock=0,
        is_active=True,
    )
    db_session.add_all([sup, prod])
    await db_session.commit()

    # 2. Create Purchase Receipt without client ID
    req = PurchaseReceiptCreate(
        supplier_id=sup.id,
        warehouse_id=wh.id,
        items=[
            PurchaseReceiptItemCreate(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity_ordered=Decimal("100"),
                quantity_received=Decimal("95"),
                quantity_damaged=Decimal("0"),
                cost_price=Decimal("300.00"),
                gst_rate=Decimal("5.00"),
            )
        ],
    )

    receipt = await service.create_purchase_receipt(req)

    # 3. Assertions on Identity Governance
    assert is_valid_uuidv7(receipt.id), f"GRN technical ID {receipt.id} is not a valid UUIDv7"
    assert is_valid_uuidv7(receipt.uuid), f"GRN uuid {receipt.uuid} is not a valid UUIDv7"
    assert re.match(r"^PUR-GRN-\d{8}$", receipt.identity_code), f"GRN identity code '{receipt.identity_code}' does not match PUR-GRN pattern"
    assert receipt.receipt_no == receipt.identity_code, "When receipt_no is omitted, it must match identity_code"

    # Line item assertions via explicit async select
    items_stmt = select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == receipt.id)
    items_res = await db_session.execute(items_stmt)
    items = items_res.scalars().all()
    assert len(items) == 1
    item = items[0]
    assert is_valid_uuidv7(item.id), f"GRN item ID {item.id} is not a valid UUIDv7"
    assert is_valid_uuidv7(item.uuid), f"GRN item uuid {item.uuid} is not a valid UUIDv7"
    assert item.batch_no.startswith(f"BATCH-{receipt.receipt_no}"), f"Batch number {item.batch_no} is not governed"


@pytest.mark.asyncio
async def test_debit_note_identity_engine_governance(db_session):
    """
    Verify Debit Note allocates RFC 9562 UUIDv7 technical ID and governed
    PUR-DN-XXXXXXXX identity code via IdentityEngine.
    """
    tenant_ctx, comp, br, wh = await _setup_tenant(db_session)
    service = PurchaseService(db_session, tenant_ctx)

    sup = Supplier(
        id=f"sup-gov-{uuid.uuid4().hex[:6]}",
        code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
        company_id=comp.id,
        branch_id=br.id,
        name="Gov Supplier DN",
        outstanding=Decimal("10000.00"),
        is_active=True,
    )
    db_session.add(sup)
    await db_session.commit()

    req = DebitNoteCreate(
        supplier_id=sup.id,
        receipt_id="GRN-TEST-REF",
        claim_amount=Decimal("1500.00"),
        tax_amount=Decimal("75.00"),
        total_debit_amount=Decimal("1575.00"),
        reason="Short delivery shortage claim",
    )

    dn = await service.create_debit_note(req)

    assert is_valid_uuidv7(dn["id"]), f"Debit note ID {dn['id']} is not a valid UUIDv7"
    assert re.match(r"^PUR-DN-\d{8}$", dn["identity_code"]), f"Debit note identity code '{dn['identity_code']}' does not match PUR-DN pattern"
    assert dn["debit_note_no"] == dn["identity_code"]


@pytest.mark.asyncio
async def test_purchase_bill_identity_engine_governance(db_session):
    """
    Verify Purchase Bill allocates RFC 9562 UUIDv7 technical ID,
    governed PUR-BIL-XXXXXXXX identity code, and registers sovereign alias.
    """
    tenant_ctx, comp, br, wh = await _setup_tenant(db_session)
    service = PurchaseService(db_session, tenant_ctx)

    sup = Supplier(
        id=f"sup-gov-{uuid.uuid4().hex[:6]}",
        code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
        company_id=comp.id,
        branch_id=br.id,
        name="Gov Supplier PB",
        outstanding=Decimal("0.00"),
        is_active=True,
    )
    db_session.add(sup)
    await db_session.commit()

    supplier_inv_no = f"INV-SUP-VENDOR-{uuid.uuid4().hex[:6].upper()}"
    req = PurchaseBillCreate(
        supplier_id=sup.id,
        bill_no=supplier_inv_no,
        taxable_amount=Decimal("5000.00"),
        tax_amount=Decimal("250.00"),
        total_amount=Decimal("5250.00"),
        notes="Tax invoice verified against delivery challan",
    )

    bill = await service.create_purchase_bill(req)

    assert is_valid_uuidv7(bill["id"]), f"Purchase bill ID {bill['id']} is not a valid UUIDv7"
    assert re.match(r"^PUR-BIL-\d{8}$", bill["identity_code"]), f"Bill identity code '{bill['identity_code']}' does not match PUR-BIL pattern"
    assert bill["bill_no"] == supplier_inv_no

    # Verify sovereign alias was registered in smriti_identity_alias
    alias_stmt = select(SmritiIdentityAlias).where(
        SmritiIdentityAlias.entity_id == bill["id"],
        SmritiIdentityAlias.alias_type == "SUPPLIER_INVOICE",
    )
    alias_res = await db_session.execute(alias_stmt)
    alias_row = alias_res.scalars().first()
    assert alias_row is not None, "Supplier invoice number was not registered as sovereign alias"
    assert alias_row.alias_code == supplier_inv_no
    assert alias_row.source_system == "SUPPLIER"


@pytest.mark.asyncio
async def test_eway_bill_identity_engine_and_alias_governance(db_session):
    """
    Verify E-Way Bill endpoint allocates RFC 9562 UUIDv7 technical ID,
    governed TAX-EWB-XXXXXXXX identity code, and registers NIC EWB number as alias.
    """
    tenant_ctx, comp, br, wh = await _setup_tenant(db_session)

    user = User(
        id=f"usr-gov-{uuid.uuid4().hex[:6]}",
        username=f"usr_gov_{uuid.uuid4().hex[:4]}",
        hashed_password=hash_password("Pass@1234"),
        role=UserRole.SYSADMIN,
        is_active=True,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
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

    # Supply official 12-digit NIC E-Way Bill number
    nic_ewb_no = "123456789012"
    res = await client.post(
        "/api/v1/sales/eway-bills/",
        headers=headers,
        json={
            "eway_bill_no": nic_ewb_no,
            "invoice_id": "INV-TEST-001",
            "consignment_value": 75000.00,
            "transporter_id": "TRP-001",
            "transporter_name": "SafeXpress Logistics",
            "transport_mode": "Road",
            "vehicle_no": "MH12AB1234",
            "distance_km": 180,
            "status": "DISPATCHED",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()

    # 1. Assert UUIDv7 Technical ID
    assert is_valid_uuidv7(data["id"]), f"E-Way bill ID {data['id']} is not a valid UUIDv7"

    # 2. Assert Governed TAX-EWB Identity Code
    assert re.match(r"^TAX-EWB-\d{8}$", data["identity_code"]), f"E-Way bill identity code '{data['identity_code']}' does not match TAX-EWB pattern"
    assert data["eway_bill_no"] == nic_ewb_no

    # 3. Assert Sovereign Alias Registration in smriti_identity_alias
    alias_stmt = select(SmritiIdentityAlias).where(
        SmritiIdentityAlias.entity_id == data["id"],
        SmritiIdentityAlias.alias_code == nic_ewb_no,
    )
    alias_res = await db_session.execute(alias_stmt)
    alias_row = alias_res.scalars().first()
    assert alias_row is not None, "Statutory NIC E-Way Bill number was not registered as sovereign alias"
    assert alias_row.alias_type == "NIC_EWAY"
    assert alias_row.source_system == "NIC_PORTAL"
    assert alias_row.canonical_identity_code == data["identity_code"]
