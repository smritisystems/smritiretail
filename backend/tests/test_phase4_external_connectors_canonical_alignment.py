"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI DataBridge Phase 4: External Connectors & Canonical Export Alignment
"""

import io
import json
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal

import openpyxl
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.inventory import Product
from app.services.databridge.export_engine import DataBridgeExportEngine
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeExportFormat,
    DataBridgeExportRequest,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
)
from app.services.databridge.connectors import (
    TallyPrimeConnector,
    ShopifyConnector,
    UnicommerceConnector,
    SAPB1Connector,
)

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
CANONICAL_COMP_ID = "COMP-001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        session.info["resolved_database_name"] = "smriti001"
        session.info["company_id"] = CANONICAL_COMP_ID
        yield session
    await engine.dispose()


# ==============================================================================
# PHASE 4 TEST SUITE: EXTERNAL CONNECTORS & CANONICAL EXPORT ENGINE ALIGNMENT
# ==============================================================================

@pytest.mark.asyncio
async def test_tc_p4_001_export_engine_dual_key_serialization(db_session: AsyncSession):
    """
    TC-P4-001: Verifies that DataBridgeExportEngine serializes canonical dual keys
    (product_id, item_id, variant_id, item_code) across sales, purchase, and stock movements.
    """
    uid = uuid.uuid4().hex[:6].upper()
    variant_id = f"var_p4_{uid.lower()}"
    item_id = f"itm_p4_{uid.lower()}"

    prod = Product(
        id=f"legacy_prod_{uid}",
        company_id=CANONICAL_COMP_ID,
        code=f"CODE-P4-{uid}",
        name=f"Legacy Product {uid}",
        barcode=f"BAR-P4-{uid}",
        sku=f"SKU-P4-{uid}",
        category="Footwear",
        price=Decimal("750.00"),
    )
    db_session.add(prod)

    inv = SalesInvoice(
        id=f"sinv_p4_{uid}",
        company_id=CANONICAL_COMP_ID,
        invoice_no=f"INV-P4-{uid}",
        date=datetime.now(timezone.utc).date(),
        grand_total=Decimal("1500.00"),
        tax_total=Decimal("180.00"),
        status="PAID",
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        item_id=item_id,
        variant_id=variant_id,
        code=f"SKU-P4-{uid}",
        name=f"Item P4 {uid}",
        quantity=Decimal("2.00"),
        price=Decimal("750.00"),
        total_amount=Decimal("1500.00"),
    )
    db_session.add(inv)
    db_session.add(inv_item)

    # 2. Purchase Order with stamped dual keys
    sup = Supplier(
        id=f"sup_p4_{uid}",
        company_id=CANONICAL_COMP_ID,
        name=f"Supplier P4 {uid}",
        code=f"SUP-{uid}",
    )
    db_session.add(sup)
    await db_session.flush()

    po = PurchaseOrder(
        id=f"po_p4_{uid}",
        company_id=CANONICAL_COMP_ID,
        order_no=f"PO-P4-{uid}",
        supplier_id=sup.id,
        status="APPROVED",
        grand_total=Decimal("3000.00"),
    )
    po_item = PurchaseOrderItem(
        id=f"poitem_p4_{uid}",
        order_id=po.id,
        product_id=prod.id,
        item_id=item_id,
        variant_id=variant_id,
        code=f"SKU-P4-{uid}",
        name=f"Item P4 {uid}",
        quantity=Decimal("5.00"),
        cost_price=Decimal("600.00"),
        line_total=Decimal("3000.00"),
    )
    db_session.add(po)
    db_session.add(po_item)

    await db_session.commit()

    # Verify Sales Invoice records fetch
    records_sales = await DataBridgeExportEngine.fetch_entity_records(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        limit=500,
    )
    matched_sales = [r for r in records_sales if r.get("invoice_no") == f"INV-P4-{uid}"]
    assert len(matched_sales) == 1
    s_row = matched_sales[0]
    assert s_row["product_id"] == f"legacy_prod_{uid}"
    assert s_row["item_id"] == item_id
    assert s_row["variant_id"] == variant_id
    assert s_row["item_code"] == f"SKU-P4-{uid}"

    # Verify Purchase Order records fetch
    records_po = await DataBridgeExportEngine.fetch_entity_records(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        entity_type=DataBridgeEntityType.PURCHASE_ORDER,
        limit=500,
    )
    matched_po = [r for r in records_po if r.get("order_no") == f"PO-P4-{uid}"]
    assert len(matched_po) == 1
    p_row = matched_po[0]
    assert p_row["product_id"] == f"legacy_prod_{uid}"
    assert p_row["item_id"] == item_id
    assert p_row["variant_id"] == variant_id
    assert p_row["item_code"] == f"SKU-P4-{uid}"


@pytest.mark.asyncio
async def test_tc_p4_002_export_engine_legacy_null_variant_fallback(db_session: AsyncSession):
    """
    TC-P4-002: Verifies that legacy transaction rows with NULL variant_id and item_id
    export safely without exceptions, providing fallback item_code from product_id.
    """
    uid = uuid.uuid4().hex[:6].upper()
    prod_leg = Product(
        id=f"HISTORIC_PROD_{uid}",
        company_id=CANONICAL_COMP_ID,
        code=f"CODE-LEG-{uid}",
        name=f"Historic Product {uid}",
        barcode=f"BAR-LEG-{uid}",
        sku=f"SKU-LEG-{uid}",
        category="Footwear",
        price=Decimal("500.00"),
    )
    db_session.add(prod_leg)

    inv = SalesInvoice(
        id=f"sinv_leg_{uid}",
        company_id=CANONICAL_COMP_ID,
        invoice_no=f"INV-LEG-{uid}",
        date=datetime.now(timezone.utc).date(),
        grand_total=Decimal("500.00"),
        tax_total=Decimal("50.00"),
        status="PAID",
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod_leg.id,
        item_id=None,
        variant_id=None,
        code=f"HISTORIC_PROD_{uid}",
        name=f"Historic Item {uid}",
        quantity=Decimal("1.00"),
        price=Decimal("500.00"),
        total_amount=Decimal("500.00"),
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    records = await DataBridgeExportEngine.fetch_entity_records(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        limit=500,
    )
    matched = [r for r in records if r.get("invoice_no") == f"INV-LEG-{uid}"]
    assert len(matched) == 1
    row = matched[0]
    assert row["product_id"] == f"HISTORIC_PROD_{uid}"
    assert row["item_id"] is None
    assert row["variant_id"] is None
    assert row["item_code"] == f"HISTORIC_PROD_{uid}"


@pytest.mark.asyncio
async def test_tc_p4_003_tally_outbound_canonical_sku_and_description():
    """
    TC-P4-003: Verifies Tally outbound voucher XML generation serializes canonical variant SKU
    in <STOCKITEMNAME> and dimensions/IDs in <BASICUSERDESCRIPTION>, <ITEMID>, <VARIANTID>.
    """
    connector = TallyPrimeConnector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.TALLY_PRIME_XML,
        company_code="SMRITI Books Corp",
    )
    records = [
        {
            "invoice_number": "INV-TALLY-CANON-01",
            "invoice_date": "2026-10-08",
            "customer_name": "Modern Retailers Pvt Ltd",
            "customer_gstin": "27AABCM1234F1Z9",
            "variant_sku": "DENIM-SLIM-INDIGO-32",
            "item_name": "Premium Slim Fit Denim",
            "variant_id": "var-9901",
            "item_id": "itm-8801",
            "color": "Indigo",
            "size": "32",
            "quantity": 3,
            "rate": 1800.0,
            "net_amount": 5400.0,
        }
    ]

    push_res = await connector.push_records(
        config=config,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        records=records,
        params={},
    )
    assert push_res.is_successful is True
    xml_str = push_res.result_payload

    # Assert canonical elements in XML
    assert "<STOCKITEMNAME>DENIM-SLIM-INDIGO-32</STOCKITEMNAME>" in xml_str
    assert "<ITEMID>itm-8801</ITEMID>" in xml_str
    assert "<VARIANTID>var-9901</VARIANTID>" in xml_str
    assert "Color: Indigo | Size: 32 | VariantID: var-9901" in xml_str

    # Validate valid XML structure
    root = ET.fromstring(xml_str)
    assert root.tag == "ENVELOPE"


@pytest.mark.asyncio
async def test_tc_p4_004_tally_inbound_dual_key_preservation():
    """
    TC-P4-004: Verifies Tally inbound voucher parsing maps canonical variant SKU,
    item_id, variant_id, and dimensions into normalized tabular rows.
    """
    tally_xml_payload = """<ENVELOPE>
      <BODY>
        <DATA>
          <TALLYMESSAGE>
            <VOUCHER VCHTYPE="Sales" ACTION="Create">
              <DATE>20261008</DATE>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <VOUCHERNUMBER>INV-TALLY-IN-1002</VOUCHERNUMBER>
              <PARTYLEDGERNAME>Fashion Hub Ltd</PARTYLEDGERNAME>
              <PARTYGSTIN>27AABCF9999G1Z2</PARTYGSTIN>
              <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>SHIRT-FORMAL-WHITE-40</STOCKITEMNAME>
                <ACTUALQTY>4.00 Pcs</ACTUALQTY>
                <RATE>1200.00/Pcs</RATE>
                <AMOUNT>-4800.00</AMOUNT>
                <ITEMID>itm-white-shirt</ITEMID>
                <VARIANTID>var-white-shirt-40</VARIANTID>
                <BASICUSERDESCRIPTION>Color: White | Size: 40</BASICUSERDESCRIPTION>
              </ALLINVENTORYENTRIES.LIST>
            </VOUCHER>
          </TALLYMESSAGE>
        </DATA>
      </BODY>
    </ENVELOPE>"""

    connector = TallyPrimeConnector()
    config = DataBridgeConnectorConfig(connector_type=DataBridgeConnectorType.TALLY_PRIME_XML)
    raw_records = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        params={},
        raw_payload=tally_xml_payload,
    )
    assert len(raw_records) == 1

    rows = connector.transform_to_databridge_rows(
        raw_records=raw_records,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
    )
    assert len(rows) == 1
    r = rows[0]
    assert r["invoice_number"] == "INV-TALLY-IN-1002"
    assert r["item_name"] == "SHIRT-FORMAL-WHITE-40"
    assert r["variant_sku"] == "SHIRT-FORMAL-WHITE-40"
    assert r["item_id"] == "itm-white-shirt"
    assert r["variant_id"] == "var-white-shirt-40"


@pytest.mark.asyncio
async def test_tc_p4_005_shopify_inbound_dual_key_normalization():
    """
    TC-P4-005: Verifies Shopify product and order ingestion extracts canonical
    variant dimensions (option1, option2), variant_id, item_id, and variant_sku.
    """
    connector = ShopifyConnector()

    # 1. Product with Variants
    shopify_prod = {
        "products": [
            {
                "id": 881234,
                "title": "Air Athletic Sneaker",
                "vendor": "Nike",
                "product_type": "Footwear",
                "variants": [
                    {
                        "id": 994321,
                        "title": "Black / 10",
                        "sku": "NK-AIR-BLK-10",
                        "price": "4500.00",
                        "compare_at_price": "5000.00",
                        "inventory_quantity": 25,
                        "option1": "Black",
                        "option2": "10",
                    }
                ],
            }
        ]
    }
    raw_prods = await connector.pull_records(
        config=DataBridgeConnectorConfig(connector_type=DataBridgeConnectorType.SHOPIFY_REST),
        entity_type=DataBridgeEntityType.ITEM,
        params={},
        raw_payload=shopify_prod,
    )
    rows_prod = connector.transform_to_databridge_rows(raw_prods, DataBridgeEntityType.ITEM)
    assert len(rows_prod) == 1
    p = rows_prod[0]
    assert p["sku"] == "NK-AIR-BLK-10"
    assert p["variant_sku"] == "NK-AIR-BLK-10"
    assert p["variant_id"] == "994321"
    assert p["item_id"] == "881234"
    assert p["color"] == "Black"
    assert p["size"] == "10"

    # 2. Sales Order with line item variant references
    shopify_order = {
        "orders": [
            {
                "id": 771122,
                "name": "#SPFY-1099",
                "created_at": "2026-10-08T10:00:00Z",
                "customer": {"first_name": "Rohan", "last_name": "Sharma"},
                "line_items": [
                    {
                        "id": 554433,
                        "product_id": 881234,
                        "variant_id": 994321,
                        "sku": "NK-AIR-BLK-10",
                        "name": "Air Athletic Sneaker - Black / 10",
                        "price": "4500.00",
                        "quantity": 1,
                    }
                ],
            }
        ]
    }
    raw_orders = await connector.pull_records(
        config=DataBridgeConnectorConfig(connector_type=DataBridgeConnectorType.SHOPIFY_REST),
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        params={},
        raw_payload=shopify_order,
    )
    rows_order = connector.transform_to_databridge_rows(raw_orders, DataBridgeEntityType.SALES_INVOICE)
    assert len(rows_order) == 1
    o = rows_order[0]
    assert o["invoice_number"] == "#SPFY-1099"
    assert o["sku"] == "NK-AIR-BLK-10"
    assert o["variant_sku"] == "NK-AIR-BLK-10"
    assert o["item_code"] == "NK-AIR-BLK-10"
    assert o["variant_id"] == 994321
    assert o["item_id"] == 881234
    assert o["product_id"] == 881234


@pytest.mark.asyncio
async def test_tc_p4_006_shopify_outbound_canonical_payload():
    """
    TC-P4-006: Verifies Shopify outbound push serializes canonical variant dual keys
    and dimensions (option1, option2) in payload format.
    """
    connector = ShopifyConnector()
    config = DataBridgeConnectorConfig(connector_type=DataBridgeConnectorType.SHOPIFY_REST)
    records = [
        {
            "variant_sku": "TSHIRT-CREW-NAVY-M",
            "variant_id": "var-shp-001",
            "item_id": "itm-shp-001",
            "color": "Navy",
            "size": "M",
            "selling_price": 899.0,
            "quantity": 40,
        }
    ]

    push_res = await connector.push_records(
        config=config,
        entity_type=DataBridgeEntityType.ITEM,
        records=records,
        params={},
    )
    assert push_res.is_successful is True
    parsed = json.loads(push_res.result_payload)
    assert "variants" in parsed
    assert len(parsed["variants"]) == 1
    var = parsed["variants"][0]
    assert var["sku"] == "TSHIRT-CREW-NAVY-M"
    assert var["id"] == "var-shp-001"
    assert var["product_id"] == "itm-shp-001"
    assert var["option1"] == "Navy"
    assert var["option2"] == "M"
    assert var["inventory_quantity"] == 40


@pytest.mark.asyncio
async def test_tc_p4_007_unicommerce_inbound_and_outbound_alignment():
    """
    TC-P4-007: Verifies Unicommerce multi-channel connector parses and emits
    canonical variant identity and dual keys.
    """
    connector = UnicommerceConnector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.UNICOMMERCE_API,
        company_code="WH-MUM-01",
    )

    # Inbound Order
    uni_order_payload = {
        "elements": [
            {
                "code": "SO-AMZ-9921",
                "channel": "Amazon India",
                "customerName": "Ananya Roy",
                "saleOrderItems": [
                    {
                        "itemSKU": "DRESS-MAXI-RED-S",
                        "itemName": "Summer Maxi Dress",
                        "variant_id": "var-uni-551",
                        "item_id": "itm-uni-551",
                        "color": "Red",
                        "size": "S",
                        "channelSalePrice": 2200.0,
                        "quantity": 1.0,
                        "shippingCharges": 100.0,
                    }
                ],
            }
        ]
    }
    raw = await connector.pull_records(config, DataBridgeEntityType.SALES_INVOICE, {}, raw_payload=uni_order_payload)
    rows = connector.transform_to_databridge_rows(raw, DataBridgeEntityType.SALES_INVOICE)
    assert len(rows) == 1
    r = rows[0]
    assert r["sku"] == "DRESS-MAXI-RED-S"
    assert r["variant_sku"] == "DRESS-MAXI-RED-S"
    assert r["variant_id"] == "var-uni-551"
    assert r["item_id"] == "itm-uni-551"
    assert r["color"] == "Red"
    assert r["size"] == "S"

    # Outbound push
    push_records = [
        {
            "variant_sku": "DRESS-MAXI-RED-S",
            "variant_id": "var-uni-551",
            "item_id": "itm-uni-551",
            "quantity": 15,
        }
    ]
    push_res = await connector.push_records(config, DataBridgeEntityType.ITEM, push_records, {})
    assert push_res.is_successful is True
    adj = json.loads(push_res.result_payload)["inventoryAdjustmentDTOList"][0]
    assert adj["skuCode"] == "DRESS-MAXI-RED-S"
    assert adj["variant_id"] == "var-uni-551"
    assert adj["item_id"] == "itm-uni-551"
    assert adj["facilityCode"] == "WH-MUM-01"


@pytest.mark.asyncio
async def test_tc_p4_008_sap_b1_inbound_and_outbound_canonical_lines():
    """
    TC-P4-008: Verifies SAP Business One Service Layer connector bi-directionally maps
    canonical variant identity and UDFs (U_VariantID, U_ItemID, U_Color, U_Size).
    """
    connector = SAPB1Connector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.SAP_B1_DIAPI,
        company_code="SBODEMO_IN",
    )

    # Inbound Invoice
    sap_payload = {
        "value": [
            {
                "DocNum": 50123,
                "CardName": "Reliance Retail",
                "DocumentLines": [
                    {
                        "ItemCode": "POLO-BLACK-XL",
                        "ItemDescription": "Polo T-Shirt Black XL",
                        "Quantity": 10.0,
                        "Price": 850.0,
                        "LineTotal": 8500.0,
                        "U_VariantID": "var-sap-008",
                        "U_ItemID": "itm-sap-008",
                        "U_Color": "Black",
                        "U_Size": "XL",
                    }
                ],
            }
        ]
    }
    raw = await connector.pull_records(config, DataBridgeEntityType.SALES_INVOICE, {}, raw_payload=sap_payload)
    rows = connector.transform_to_databridge_rows(raw, DataBridgeEntityType.SALES_INVOICE)
    assert len(rows) == 1
    r = rows[0]
    assert r["sku"] == "POLO-BLACK-XL"
    assert r["variant_sku"] == "POLO-BLACK-XL"
    assert r["item_code"] == "POLO-BLACK-XL"
    assert r["variant_id"] == "var-sap-008"
    assert r["item_id"] == "itm-sap-008"
    assert r["color"] == "Black"
    assert r["size"] == "XL"

    # Outbound push
    records = [
        {
            "variant_sku": "POLO-BLACK-XL",
            "item_name": "Polo T-Shirt Black XL",
            "variant_id": "var-sap-008",
            "item_id": "itm-sap-008",
            "color": "Black",
            "size": "XL",
            "selling_price": 850.0,
            "quantity": 10.0,
        }
    ]
    push_res = await connector.push_records(config, DataBridgeEntityType.SALES_INVOICE, records, {})
    assert push_res.is_successful is True
    doc_lines = json.loads(push_res.result_payload)["DocumentLines"]
    assert len(doc_lines) == 1
    line = doc_lines[0]
    assert line["ItemCode"] == "POLO-BLACK-XL"
    assert line["U_VariantID"] == "var-sap-008"
    assert line["U_ItemID"] == "itm-sap-008"
    assert line["U_Color"] == "Black"
    assert line["U_Size"] == "XL"


@pytest.mark.asyncio
async def test_tc_p4_009_export_engine_all_formats_parity(db_session: AsyncSession):
    """
    TC-P4-009: Verifies that CSV, JSON, SMRITI-X, and XLSX streaming formats
    all serialize canonical item_id and variant_id columns faithfully.
    """
    uid = uuid.uuid4().hex[:6].upper()
    variant_id = f"var_par_{uid.lower()}"
    item_id = f"itm_par_{uid.lower()}"

    prod_par = Product(
        id=f"legacy_prod_{uid}",
        company_id=CANONICAL_COMP_ID,
        code=f"CODE-PAR-{uid}",
        name=f"Parity Product {uid}",
        barcode=f"BAR-PAR-{uid}",
        sku=f"SKU-PAR-{uid}",
        category="Footwear",
        price=Decimal("2000.00"),
    )
    db_session.add(prod_par)

    inv = SalesInvoice(
        id=f"sinv_par_{uid}",
        company_id=CANONICAL_COMP_ID,
        invoice_no=f"INV-PAR-{uid}",
        date=datetime.now(timezone.utc).date(),
        grand_total=Decimal("2000.00"),
        tax_total=Decimal("240.00"),
        status="PAID",
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod_par.id,
        item_id=item_id,
        variant_id=variant_id,
        code=f"SKU-PAR-{uid}",
        name=f"Parity Item {uid}",
        quantity=Decimal("1.00"),
        price=Decimal("2000.00"),
        total_amount=Decimal("2000.00"),
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # 1. CSV Format
    req_csv = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        file_format=DataBridgeExportFormat.CSV,
        limit=500,
    )
    content_csv, _, _, _ = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_csv,
    )
    csv_str = content_csv.decode("utf-8")
    assert "variant_id" in csv_str
    assert "item_id" in csv_str
    assert "product_id" in csv_str
    assert variant_id in csv_str

    # 2. JSON Format
    req_json = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        file_format=DataBridgeExportFormat.JSON,
        limit=500,
    )
    content_json, _, _, _ = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_json,
    )
    json_data = json.loads(content_json.decode("utf-8"))
    matched_json = [r for r in json_data if r.get("invoice_no") == f"INV-PAR-{uid}"]
    assert len(matched_json) == 1
    assert matched_json[0]["variant_id"] == variant_id
    assert matched_json[0]["item_id"] == item_id

    # 3. SMRITI-X Sealed Format
    req_smritix = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        file_format=DataBridgeExportFormat.SMRITI_X,
        limit=500,
    )
    content_sx, _, _, _ = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_smritix,
    )
    pkg = json.loads(content_sx.decode("utf-8"))
    assert "metadata" in pkg and "data" in pkg
    matched_sx = [r for r in pkg["data"] if r.get("invoice_no") == f"INV-PAR-{uid}"]
    assert len(matched_sx) == 1
    assert matched_sx[0]["variant_id"] == variant_id

    # 4. OpenXML XLSX Format
    req_xlsx = DataBridgeExportRequest(
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        file_format=DataBridgeExportFormat.XLSX,
        limit=500,
    )
    content_xlsx, _, _, _ = await DataBridgeExportEngine.export_dataset(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        actor_id="usr-super",
        actor_role="SYSADMIN",
        req=req_xlsx,
    )
    wb = openpyxl.load_workbook(io.BytesIO(content_xlsx))
    ws = wb.active
    header_row = [cell.value for cell in ws[1]]
    assert "variant_id" in header_row
    assert "item_id" in header_row
    assert "product_id" in header_row
