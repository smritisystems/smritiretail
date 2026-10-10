"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — SMRITI DataBridge Phase 8
"""

import pytest
import xml.etree.ElementTree as ET
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.models.capability_template import TenantCapabilityBinding
from app.api.deps import get_company_db, get_current_user
from app.api.v1.databridge import require_databridge_entitlement
from unittest.mock import MagicMock
from app.services.databridge.models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
    DataBridgeConnectorTestRequest,
    DataBridgeConnectorPullRequest,
    DataBridgeConnectorPushRequest,
)
from app.services.databridge.connectors import (
    DataBridgeConnectorOrchestrator,
    TallyPrimeConnector,
    ShopifyConnector,
    SAPB1Connector,
    UnicommerceConnector,
)


@pytest.fixture
def auth_headers():
    token = create_access_token(
        data={
            "sub": "test_sysadmin",
            "role": UserRole.SYSADMIN.value,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_tc_conn_001_connector_registry_and_descriptors():
    """Verify connector orchestrator registry lists all 4 enterprise connectors."""
    descriptors = DataBridgeConnectorOrchestrator.list_connectors()
    assert len(descriptors) >= 4
    
    types = {d.connector_type for d in descriptors}
    assert DataBridgeConnectorType.TALLY_PRIME_XML in types
    assert DataBridgeConnectorType.SHOPIFY_REST in types
    assert DataBridgeConnectorType.SAP_B1_DIAPI in types
    assert DataBridgeConnectorType.UNICOMMERCE_API in types

    tally_desc = next(d for d in descriptors if d.connector_type == DataBridgeConnectorType.TALLY_PRIME_XML)
    assert tally_desc.supports_pull is True
    assert tally_desc.supports_push is True
    assert "company_code" in tally_desc.config_schema


@pytest.mark.asyncio
async def test_tc_conn_002_tally_xml_voucher_ingestion():
    """Verify TallyPrime XML voucher parsing into canonical SMRITI sales invoice rows."""
    tally_xml_sample = """<ENVELOPE>
      <BODY>
        <DATA>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Sales" ACTION="Create">
              <DATE>20261005</DATE>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <VOUCHERNUMBER>INV-TALLY-1001</VOUCHERNUMBER>
              <PARTYLEDGERNAME>ABC Enterprises</PARTYLEDGERNAME>
              <PARTYGSTIN>27AAAAA0000A1Z5</PARTYGSTIN>
              <PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>
              <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>Cotton T-Shirt L</STOCKITEMNAME>
                <ACTUALQTY>5.00 Pcs</ACTUALQTY>
                <BILLEDQTY>5.00 Pcs</BILLEDQTY>
                <RATE>500.00/Pcs</RATE>
                <AMOUNT>-2500.00</AMOUNT>
              </ALLINVENTORYENTRIES.LIST>
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>CGST Output 9%</LEDGERNAME>
                <AMOUNT>-225.00</AMOUNT>
              </LEDGERENTRIES.LIST>
              <LEDGERENTRIES.LIST>
                <LEDGERNAME>SGST Output 9%</LEDGERNAME>
                <AMOUNT>-225.00</AMOUNT>
              </LEDGERENTRIES.LIST>
            </VOUCHER>
          </TALLYMESSAGE>
        </DATA>
      </BODY>
    </ENVELOPE>"""

    connector = TallyPrimeConnector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.TALLY_PRIME_XML,
        company_code="Test Retails Ltd",
    )
    raw_records = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        params={},
        raw_payload=tally_xml_sample,
    )
    assert len(raw_records) == 1
    assert raw_records[0]["voucher_number"] == "INV-TALLY-1001"
    assert raw_records[0]["party_ledger_name"] == "ABC Enterprises"

    rows = connector.transform_to_databridge_rows(
        raw_records=raw_records,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
    )
    assert len(rows) == 1
    row = rows[0]
    assert row["invoice_number"] == "INV-TALLY-1001"
    assert row["invoice_date"] == "2026-10-05"
    assert row["customer_name"] == "ABC Enterprises"
    assert row["customer_gstin"] == "27AAAAA0000A1Z5"
    assert row["item_name"] == "Cotton T-Shirt L"
    assert row["quantity"] == 5.0
    assert row["rate"] == 500.0
    assert row["taxable_amount"] == 2500.0
    assert row["cgst_amount"] == 225.0
    assert row["sgst_amount"] == 225.0
    assert row["net_amount"] == 2950.0


@pytest.mark.asyncio
async def test_tc_conn_003_tally_outbound_xml_generation():
    """Verify serializing SMRITI records into standard TallyPrime XML envelope."""
    connector = TallyPrimeConnector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.TALLY_PRIME_XML,
        company_code="SMRITI Books Corp",
    )
    records = [
        {
            "invoice_number": "INV-2026-0099",
            "invoice_date": "2026-10-06",
            "customer_name": "Metro Retailers",
            "customer_gstin": "29BBBBB1111B2Z3",
            "item_name": "Premium Denim 32",
            "quantity": 2,
            "rate": 1200.0,
            "net_amount": 2400.0,
        }
    ]

    push_res = await connector.push_records(
        config=config,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        records=records,
        params={},
    )
    assert push_res.is_successful is True
    assert push_res.payload_format == "XML"
    assert push_res.total_records_pushed == 1
    assert "<TALLYREQUEST>Import Data</TALLYREQUEST>" in push_res.result_payload
    assert "<SVCURRENTCOMPANY>SMRITI Books Corp</SVCURRENTCOMPANY>" in push_res.result_payload
    assert "<VOUCHERNUMBER>INV-2026-0099</VOUCHERNUMBER>" in push_res.result_payload

    # Ensure valid XML parse
    root = ET.fromstring(push_res.result_payload)
    assert root.tag == "ENVELOPE"


@pytest.mark.asyncio
async def test_tc_conn_004_shopify_product_and_order_ingestion():
    """Verify Shopify product variant flattening and order line items normalization."""
    connector = ShopifyConnector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.SHOPIFY_REST,
        endpoint_url="https://test-shop.myshopify.com/admin/api/2024-04",
        access_token="shpat_sample_secret_token",
    )

    # 1. Product Ingestion with Variants
    shopify_product_payload = {
        "products": [
            {
                "id": 101,
                "title": "Classic Polo T-Shirt",
                "vendor": "Arrow",
                "product_type": "Apparel",
                "variants": [
                    {
                        "id": 1011,
                        "title": "M / Blue",
                        "sku": "POLO-BLU-M",
                        "price": "899.00",
                        "compare_at_price": "1199.00",
                        "barcode": "89010001001",
                        "inventory_quantity": 25,
                    },
                    {
                        "id": 1012,
                        "title": "L / Blue",
                        "sku": "POLO-BLU-L",
                        "price": "899.00",
                        "compare_at_price": "1199.00",
                        "barcode": "89010001002",
                        "inventory_quantity": 18,
                    },
                ],
            }
        ]
    }

    raw_items = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.ITEM,
        params={},
        raw_payload=shopify_product_payload,
    )
    assert len(raw_items) == 1
    transformed_items = connector.transform_to_databridge_rows(raw_items, DataBridgeEntityType.ITEM)
    assert len(transformed_items) == 2
    assert transformed_items[0]["sku"] == "POLO-BLU-M"
    assert transformed_items[0]["item_name"] == "Classic Polo T-Shirt - M / Blue"
    assert transformed_items[0]["mrp"] == 1199.0
    assert transformed_items[0]["selling_price"] == 899.0
    assert transformed_items[0]["opening_stock"] == 25.0

    # 2. Order Ingestion with Tax Lines
    shopify_order_payload = {
        "orders": [
            {
                "id": 5001,
                "name": "#1050",
                "created_at": "2026-10-06T14:30:00Z",
                "customer": {
                    "first_name": "Rahul",
                    "last_name": "Sharma",
                    "email": "rahul.sharma@example.com",
                    "phone": "+919876543210",
                },
                "shipping_address": {
                    "province": "Karnataka",
                    "zip": "560001",
                },
                "line_items": [
                    {
                        "id": 801,
                        "title": "Classic Polo T-Shirt - M / Blue",
                        "sku": "POLO-BLU-M",
                        "quantity": 2,
                        "price": "899.00",
                        "total_discount": "100.00",
                        "tax_lines": [{"price": "89.90", "rate": 0.05}],
                    }
                ],
            }
        ]
    }

    raw_orders = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        params={},
        raw_payload=shopify_order_payload,
    )
    transformed_orders = connector.transform_to_databridge_rows(raw_orders, DataBridgeEntityType.SALES_INVOICE)
    assert len(transformed_orders) == 1
    ord_row = transformed_orders[0]
    assert ord_row["invoice_number"] == "#1050"
    assert ord_row["invoice_date"] == "2026-10-06"
    assert ord_row["customer_name"] == "Rahul Sharma"
    assert ord_row["shipping_state"] == "Karnataka"
    assert ord_row["quantity"] == 2.0
    assert ord_row["rate"] == 899.0
    assert ord_row["discount_amount"] == 100.0
    assert ord_row["taxable_amount"] == 1698.0
    assert ord_row["net_amount"] == 1698.0 + 89.90


@pytest.mark.asyncio
async def test_tc_conn_005_sap_b1_master_and_invoice_ingestion():
    """Verify SAP Business One OITM, OCRD, and OINV payload normalization."""
    connector = SAPB1Connector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.SAP_B1_DIAPI,
        endpoint_url="https://sapb1:50000/b1s/v1",
        company_code="SB_DEMO_IN",
    )

    # 1. SAP OITM (Items)
    sap_items_payload = {
        "value": [
            {
                "ItemCode": "A1000",
                "ItemName": "Laser Printer Cartridge",
                "BarCode": "8905551122334",
                "OnHand": 12.0,
                "Price": 1450.0,
                "SalUnitMsr": "NOS",
                "ItmsGrpCod": "Office Supplies",
            }
        ]
    }
    raw_sap_items = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.ITEM,
        params={},
        raw_payload=sap_items_payload,
    )
    rows = connector.transform_to_databridge_rows(raw_sap_items, DataBridgeEntityType.ITEM)
    assert len(rows) == 1
    assert rows[0]["sku"] == "A1000"
    assert rows[0]["item_name"] == "Laser Printer Cartridge"
    assert rows[0]["barcode"] == "8905551122334"
    assert rows[0]["opening_stock"] == 12.0
    assert rows[0]["selling_price"] == 1450.0

    # 2. SAP OCRD (Business Partners)
    sap_bp_payload = {
        "value": [
            {
                "CardCode": "C20001",
                "CardName": "Zenith Infotech Ltd",
                "LicTradNum": "27AAACZ1234F1ZP",
                "Phone1": "9820011223",
                "EmailAddress": "info@zenith.com",
                "CurrentAccountBalance": 45000.0,
                "State": "Maharashtra",
            }
        ]
    }
    raw_bp = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.CUSTOMER,
        params={},
        raw_payload=sap_bp_payload,
    )
    bp_rows = connector.transform_to_databridge_rows(raw_bp, DataBridgeEntityType.CUSTOMER)
    assert len(bp_rows) == 1
    assert bp_rows[0]["party_code"] == "C20001"
    assert bp_rows[0]["name"] == "Zenith Infotech Ltd"
    assert bp_rows[0]["gstin"] == "27AAACZ1234F1ZP"
    assert bp_rows[0]["opening_balance"] == 45000.0


@pytest.mark.asyncio
async def test_tc_conn_006_unicommerce_multichannel_order_ingestion():
    """Verify Unicommerce Uniware multi-channel order normalization."""
    connector = UnicommerceConnector()
    config = DataBridgeConnectorConfig(
        connector_type=DataBridgeConnectorType.UNICOMMERCE_API,
        endpoint_url="https://demostore.unicommerce.com/services/rest/v1",
        api_key="demo_uniware_token",
        company_code="WH-NORTH-01",
    )

    uni_order_payload = {
        "saleOrderDTOList": [
            {
                "code": "AMZ-ORD-8899",
                "displayOrderCode": "404-1234567-8910111",
                "channel": "AMAZON_IN",
                "orderDate": "2026-10-06",
                "shippingAddress": {
                    "name": "Pooja Varma",
                    "phone": "9988776655",
                    "state": "Delhi",
                    "pincode": "110001",
                },
                "saleOrderItems": [
                    {
                        "itemSKU": "RUN-SHOE-RED-08",
                        "itemName": "Speedster Running Shoes Red 8",
                        "channelSalePrice": 2499.0,
                        "quantity": 1,
                        "discount": 200.0,
                        "shippingCharges": 50.0,
                    }
                ],
            }
        ]
    }

    raw_orders = await connector.pull_records(
        config=config,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        params={},
        raw_payload=uni_order_payload,
    )
    rows = connector.transform_to_databridge_rows(raw_orders, DataBridgeEntityType.SALES_INVOICE)
    assert len(rows) == 1
    r = rows[0]
    assert r["invoice_number"] == "404-1234567-8910111"
    assert r["channel"] == "AMAZON_IN"
    assert r["customer_name"] == "Pooja Varma"
    assert r["sku"] == "RUN-SHOE-RED-08"
    assert r["rate"] == 2499.0
    assert r["discount_amount"] == 200.0
    assert r["taxable_amount"] == 2299.0
    assert r["net_amount"] == 2349.0  # 2299 + 50 shipping


@pytest.mark.asyncio
async def test_tc_conn_007_fastapi_rest_connector_endpoints(auth_headers):
    """Verify FastAPI connector REST endpoints: list, test, pull, and push."""
    test_user = User(
        id="usr-super",
        username="test_sysadmin",
        email="test_sysadmin@example.com",
        role=UserRole.SYSADMIN,
        is_active=True,
    )
    test_binding = MagicMock(spec=TenantCapabilityBinding)
    test_binding.is_active = True

    async def override_get_company_db():
        yield MagicMock()

    async def override_get_current_user():
        return test_user

    async def override_require_databridge_entitlement():
        return test_binding

    app.dependency_overrides[get_company_db] = override_get_company_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_databridge_entitlement] = override_require_databridge_entitlement

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. GET /api/v1/databridge/connectors
            res_list = await client.get("/api/v1/databridge/connectors", headers=auth_headers)
            assert res_list.status_code == 200, res_list.text
            connectors_data = res_list.json()
            assert len(connectors_data) >= 4

            # 2. POST /api/v1/databridge/connectors/test
            test_req = {
                "connector_type": "TALLY_PRIME_XML",
                "config": {
                    "connector_type": "TALLY_PRIME_XML",
                    "company_code": "Test Retails Ltd",
                },
            }
            res_test = await client.post("/api/v1/databridge/connectors/test", json=test_req, headers=auth_headers)
            assert res_test.status_code == 200, res_test.text
            test_json = res_test.json()
            assert test_json["is_successful"] is True
            assert "Test Retails Ltd" in test_json["status_message"]

            # 3. POST /api/v1/databridge/connectors/pull (with raw Shopify payload)
            pull_req = {
                "connector_type": "SHOPIFY_REST",
                "entity_type": "ITEM",
                "config": {
                    "connector_type": "SHOPIFY_REST",
                    "endpoint_url": "https://test.myshopify.com",
                    "access_token": "shpat_test",
                },
                "raw_payload": {
                    "products": [
                        {
                            "id": 99,
                            "title": "Smart Watch S1",
                            "vendor": "Noise",
                            "price": "1999.00",
                            "inventory_quantity": 50,
                        }
                    ]
                },
            }
            res_pull = await client.post("/api/v1/databridge/connectors/pull", json=pull_req, headers=auth_headers)
            assert res_pull.status_code == 200, res_pull.text
            pull_json = res_pull.json()
            assert pull_json["total_records_pulled"] == 1
            assert pull_json["rows"][0]["item_name"] == "Smart Watch S1"
            assert pull_json["rows"][0]["selling_price"] == 1999.0

            # 4. POST /api/v1/databridge/connectors/push (with Tally export)
            push_req = {
                "connector_type": "TALLY_PRIME_XML",
                "entity_type": "SALES_INVOICE",
                "config": {
                    "connector_type": "TALLY_PRIME_XML",
                    "company_code": "Test Retails Ltd",
                },
                "records": [
                    {
                        "invoice_number": "INV-P8-01",
                        "invoice_date": "2026-10-06",
                        "customer_name": "Apex Traders",
                        "item_name": "Wireless Mouse",
                        "quantity": 3,
                        "rate": 450.0,
                        "net_amount": 1350.0,
                    }
                ],
            }
            res_push = await client.post("/api/v1/databridge/connectors/push", json=push_req, headers=auth_headers)
            assert res_push.status_code == 200, res_push.text
            push_json = res_push.json()
            assert push_json["is_successful"] is True
            assert push_json["payload_format"] == "XML"
            assert "<VOUCHERNUMBER>INV-P8-01</VOUCHERNUMBER>" in push_json["result_payload"]
    finally:
        app.dependency_overrides.clear()
