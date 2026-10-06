import pytest

from app.models.item_master import Item, ItemVariant
from app.services.barcode_policy import detect_barcode_type
from app.services.barcode_registry import BarcodeRegistryService


def test_barcode_detection_returns_hints_without_assignment():
    ean = detect_barcode_type("8901234567890")
    assert ean["detected"] is True
    assert ean["candidates"] == ["EAN13"]

    gs1 = detect_barcode_type("(01)08901234567890(17)270930")
    assert gs1["encoding_standard"] == "GS1"
    assert "GS1_128" in gs1["candidates"]

    internal = detect_barcode_type("STOCK-ABC-001")
    assert internal["confidence"] == "LOW"
    assert len(internal["candidates"]) > 1


import uuid

@pytest.mark.asyncio
async def test_gs1_barcode_assigns_once_to_variant_sku(db_session):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_id = f"COMP-GS1-{suffix}"
    item = Item(
        id=f"itm-gs1-{suffix}", company_id=comp_id, item_code=f"STYLE-GS1-{suffix}",
        item_name="GS1 Test Item", item_type="FINISHED_GOOD", category="TEST", status="ACTIVE",
        tax_rate=18, primary_uom="PCS", uom="PCS",
    )
    variant = ItemVariant(
        id=f"var-gs1-{suffix}", company_id=comp_id, item_id=item.id,
        variant_sku=f"STYLE-GS1-{suffix}-BLUE-M", variant_name="Blue M", is_active=True,
    )
    db_session.add_all([item, variant])
    await db_session.commit()

    record = await BarcodeRegistryService.intake(
        db_session, comp_id, "BR-GS1-A", "user-gs1", " 8901234567890 ",
        "EAN13", "GS1_IMPORT", f"GS1-PORTAL-IMPORT-{suffix}",
    )
    assert record.status == "UNASSIGNED"
    assert record.barcode_normalized == "8901234567890"

    assigned = await BarcodeRegistryService.assign(
        db_session, comp_id, "BR-GS1-A", "user-gs1", record.id,
        variant_sku=f"STYLE-GS1-{suffix}-BLUE-M",
        reason="GS1 barcode belongs to the variant stock number",
    )
    assert assigned.status == "ASSIGNED"
    assert assigned.variant_id == variant.id
    assert assigned.item_id == item.id

    with pytest.raises(ValueError, match="Only UNASSIGNED"):
        await BarcodeRegistryService.assign(
            db_session, comp_id, "BR-GS1-A", "user-gs1", record.id,
            variant_sku=f"STYLE-GS1-{suffix}-BLUE-M",
        )

    with pytest.raises(ValueError, match="already exists"):
        await BarcodeRegistryService.intake(
            db_session, comp_id, "BR-GS1-A", "user-gs1", "8901234567890",
            "EAN13", "GS1_IMPORT", None,
        )


@pytest.mark.asyncio
async def test_gs1_barcode_cannot_be_resolved_across_tenants(db_session):
    suffix = uuid.uuid4().hex[:6].upper()
    comp_a = f"COMP-GS1-{suffix}-A"
    comp_b = f"COMP-GS1-{suffix}-B"
    record = await BarcodeRegistryService.intake(
        db_session, comp_a, "BR-GS1-A", "user-gs1", "8901234567891",
        "EAN13", "GS1_IMPORT", None,
    )

    with pytest.raises(LookupError, match="not found"):
        await BarcodeRegistryService.assign(
            db_session, comp_b, "BR-GS1-B", "user-other-tenant", record.id,
            item_code=f"STYLE-GS1-{suffix}",
        )