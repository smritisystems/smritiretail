"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.fulfillment import (
    PackingSlip,
    PackingSlipItem,
    Dispatch,
    DispatchItem,
    DeliveryCommissionSettlement,
    ReverseLogisticsReturn,
)
from app.services.fulfillment_engine import FulfillmentEngine
from app.schemas.fulfillment import (
    PackingSlipCreateRequest,
    PackingSlipItemCreate,
    DispatchCreateRequest,
    DeliveryStatusUpdateRequest,
    ReverseLogisticsCreateRequest,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_packing_slip_creation_and_item_lines():
    """Verify pick & pack slip generation with multiple item lines and package weight."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    inv_id = f"inv_ful_{unique_suffix}"

    async with sessionmaker() as session:
        ps_req = PackingSlipCreateRequest(
            sales_invoice_id=inv_id,
            packed_by_user_id="usr-packer-1",
            total_packages=2,
            weight_kg=Decimal("1.250"),
            items=[
                PackingSlipItemCreate(
                    product_id=f"prod_1_{unique_suffix}",
                    sku="SKU-SHIRT-M",
                    quantity=Decimal("2.000"),
                    batch_number="BATCH-2026-01",
                ),
                PackingSlipItemCreate(
                    product_id=f"prod_2_{unique_suffix}",
                    sku="SKU-TROUSER-32",
                    quantity=Decimal("1.000"),
                    batch_number=None,
                ),
            ],
        )

        res = await FulfillmentEngine.create_packing_slip(session, "COMP-001", ps_req, created_by="usr-super")
        assert res.sales_invoice_id == inv_id
        assert res.status == "PACKED"
        assert res.total_packages == 2
        assert res.weight_kg == Decimal("1.250")
        assert len(res.items) == 2
        assert res.items[0].sku == "SKU-SHIRT-M"
        assert res.items[0].quantity == Decimal("2.000")


@pytest.mark.asyncio
async def test_dispatch_creation_with_courier_and_awb():
    """Verify dispatch manifest creation with courier assignment, AWB, and line item replication."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    inv_id = f"inv_dsp_{unique_suffix}"

    async with sessionmaker() as session:
        # Create pack slip
        ps = await FulfillmentEngine.create_packing_slip(
            session=session,
            company_id="COMP-001",
            req=PackingSlipCreateRequest(
                sales_invoice_id=inv_id,
                items=[
                    PackingSlipItemCreate(
                        product_id=f"prod_dsp_{unique_suffix}",
                        sku="SKU-JEANS-34",
                        quantity=Decimal("3.000"),
                    )
                ],
            ),
        )

        # Create dispatch
        dsp_req = DispatchCreateRequest(
            packing_slip_id=ps.id,
            courier_partner="BlueDart",
            tracking_number=f"BD-{unique_suffix.upper()}",
            driver_person_id="drv-007",
            delivery_fee=Decimal("75.00"),
            driver_commission=Decimal("50.00"),
        )
        dsp_res = await FulfillmentEngine.create_dispatch(session, "COMP-001", dsp_req, created_by="usr-super")
        assert dsp_res.courier_partner == "BlueDart"
        assert dsp_res.tracking_number == f"BD-{unique_suffix.upper()}"
        assert dsp_res.status == "DISPATCHED"
        assert dsp_res.driver_commission == Decimal("50.00")
        assert len(dsp_res.items) == 1
        assert dsp_res.items[0].quantity == Decimal("3.000")


@pytest.mark.asyncio
async def test_delivery_status_progression_and_commission_settlement():
    """Verify delivery status transition to DELIVERED and automatic driver commission settlement."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        ps = await FulfillmentEngine.create_packing_slip(
            session=session,
            company_id="COMP-001",
            req=PackingSlipCreateRequest(
                sales_invoice_id=f"inv_stat_{unique_suffix}",
                items=[PackingSlipItemCreate(product_id="prod_test", sku="SKU-TEST", quantity=Decimal("1"))],
            ),
        )
        dsp = await FulfillmentEngine.create_dispatch(
            session=session,
            company_id="COMP-001",
            req=DispatchCreateRequest(
                packing_slip_id=ps.id,
                driver_person_id=f"drv_{unique_suffix}",
                driver_commission=Decimal("50.00"),
            ),
        )

        # 1. Transition to IN_TRANSIT
        st1 = await FulfillmentEngine.update_delivery_status(
            session=session,
            company_id="COMP-001",
            req=DeliveryStatusUpdateRequest(dispatch_id=dsp.id, status="IN_TRANSIT"),
        )
        assert st1.current_status == "IN_TRANSIT"
        assert st1.commission_settled == False

        # 2. Transition to DELIVERED -> Triggers commission settlement
        st2 = await FulfillmentEngine.update_delivery_status(
            session=session,
            company_id="COMP-001",
            req=DeliveryStatusUpdateRequest(dispatch_id=dsp.id, status="DELIVERED"),
        )
        assert st2.current_status == "DELIVERED"
        assert st2.delivered_date is not None
        assert st2.commission_settled == True

        # Verify settlement in DB
        stmt_set = select(DeliveryCommissionSettlement).where(
            DeliveryCommissionSettlement.company_id == "COMP-001",
            DeliveryCommissionSettlement.participant_id == f"drv_{unique_suffix}",
        )
        settlement = (await session.execute(stmt_set)).scalars().first()
        assert settlement is not None
        assert settlement.total_commission_amount == Decimal("50.00")
        assert settlement.settlement_status == "SETTLED"


@pytest.mark.asyncio
async def test_tracking_query_by_awb():
    """Verify live tracking query using tracking number."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    awb = f"AWB-TRACK-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        ps = await FulfillmentEngine.create_packing_slip(
            session=session,
            company_id="COMP-001",
            req=PackingSlipCreateRequest(
                sales_invoice_id=f"inv_trk_{unique_suffix}",
                items=[PackingSlipItemCreate(product_id="prod_test", sku="SKU-TEST", quantity=Decimal("1"))],
            ),
        )
        dsp = await FulfillmentEngine.create_dispatch(
            session=session,
            company_id="COMP-001",
            req=DispatchCreateRequest(
                packing_slip_id=ps.id,
                tracking_number=awb,
                courier_partner="Delhivery",
            ),
        )

        tracking = await FulfillmentEngine.get_tracking_info(session, "COMP-001", awb)
        assert tracking is not None
        assert tracking.tracking_number == awb
        assert tracking.courier_partner == "Delhivery"
        assert tracking.current_status == "DISPATCHED"


@pytest.mark.asyncio
async def test_reverse_logistics_and_commission_reversal():
    """Verify return manifest creation and commission reversal flag."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        ps = await FulfillmentEngine.create_packing_slip(
            session=session,
            company_id="COMP-001",
            req=PackingSlipCreateRequest(
                sales_invoice_id=f"inv_ret_{unique_suffix}",
                items=[PackingSlipItemCreate(product_id="prod_test", sku="SKU-TEST", quantity=Decimal("1"))],
            ),
        )
        dsp = await FulfillmentEngine.create_dispatch(
            session=session,
            company_id="COMP-001",
            req=DispatchCreateRequest(packing_slip_id=ps.id),
        )

        ret_res = await FulfillmentEngine.process_reverse_logistics(
            session=session,
            company_id="COMP-001",
            req=ReverseLogisticsCreateRequest(
                original_dispatch_id=dsp.id,
                sales_return_id=f"sr_{unique_suffix}",
                reason="Customer requested exchange of size",
                restock_status="RESTOCKED",
            ),
        )
        assert ret_res.original_dispatch_id == dsp.id
        assert ret_res.restock_status == "RESTOCKED"
        assert ret_res.commission_reversed == True


@pytest.mark.asyncio
async def test_api_fulfillment_endpoints_and_timeline():
    """Verify REST API fulfillment endpoints and aggregated timeline."""
    unique_suffix = uuid.uuid4().hex[:4]
    inv_id = f"inv_api_{unique_suffix}"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create packing slip via API
        pack_res = await client.post(
            "/api/v1/fulfillment/pack",
            json={
                "sales_invoice_id": inv_id,
                "total_packages": 1,
                "weight_kg": 0.800,
                "items": [
                    {"product_id": f"prod_api_{unique_suffix}", "sku": "SKU-API-1", "quantity": 2.0}
                ],
            },
            headers=_get_auth_headers(),
        )
        assert pack_res.status_code == 201
        ps_id = pack_res.json()["id"]

        # 2. Get packing slip via API
        get_ps = await client.get(f"/api/v1/fulfillment/pack/{ps_id}", headers=_get_auth_headers())
        assert get_ps.status_code == 200

        # 3. Create dispatch via API
        awb = f"AWB-API-{unique_suffix.upper()}"
        dsp_res = await client.post(
            "/api/v1/fulfillment/dispatch",
            json={
                "packing_slip_id": ps_id,
                "courier_partner": "In-House Driver",
                "tracking_number": awb,
                "driver_person_id": f"drv_api_{unique_suffix}",
                "driver_commission": 50.0,
            },
            headers=_get_auth_headers(),
        )
        assert dsp_res.status_code == 201
        dsp_id = dsp_res.json()["id"]

        # 4. Update delivery status to DELIVERED via API
        st_res = await client.post(
            "/api/v1/fulfillment/delivery/status",
            json={"dispatch_id": dsp_id, "status": "DELIVERED"},
            headers=_get_auth_headers(),
        )
        assert st_res.status_code == 200
        assert st_res.json()["current_status"] == "DELIVERED"
        assert st_res.json()["commission_settled"] == True

        # 5. Track via API
        trk_res = await client.get(f"/api/v1/fulfillment/tracking/{awb}", headers=_get_auth_headers())
        assert trk_res.status_code == 200
        assert trk_res.json()["current_status"] == "DELIVERED"

        # 6. Create reverse logistics return via API
        ret_res = await client.post(
            "/api/v1/fulfillment/returns",
            json={
                "original_dispatch_id": dsp_id,
                "sales_return_id": f"sr_api_{unique_suffix}",
                "reason": "Defective item",
                "restock_status": "SCRAPPED",
            },
            headers=_get_auth_headers(),
        )
        assert ret_res.status_code == 201

        # 7. Get full timeline for invoice
        tl_res = await client.get(f"/api/v1/fulfillment/timeline/{inv_id}", headers=_get_auth_headers())
        assert tl_res.status_code == 200
        events = tl_res.json()["events"]
        assert len(events) >= 3  # PACKED, DISPATCHED, DELIVERED, RETURNED
