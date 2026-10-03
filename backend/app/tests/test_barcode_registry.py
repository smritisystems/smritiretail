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


@pytest.mark.asyncio
async def test_gs1_barcode_assigns_once_to_variant_sku(db_session):
    item = Item(
        id="itm-gs1-001", company_id="COMP-GS1-A", item_code="STYLE-GS1-001",
        item_name="GS1 Test Item", item_type="FINISHED_GOOD", category="TEST", status="ACTIVE",
        tax_rate=18, primary_uom="PCS",
    )
    variant = ItemVariant(
        id="var-gs1-001", company_id="COMP-GS1-A", item_id=item.id,
        variant_sku="STYLE-GS1-001-BLUE-M", variant_name="Blue M", is_active=True,
    )
    db_session.add_all([item, variant])
    await db_session.commit()

    record = await BarcodeRegistryService.intake(
        db_session, "COMP-GS1-A", "BR-GS1-A", "user-gs1", " 8901234567890 ",
        "EAN13", "GS1_IMPORT", "GS1-PORTAL-IMPORT-001",
    )
    assert record.status == "UNASSIGNED"
    assert record.barcode_normalized == "8901234567890"

    assigned = await BarcodeRegistryService.assign(
        db_session, "COMP-GS1-A", "BR-GS1-A", "user-gs1", record.id,
        variant_sku="STYLE-GS1-001-BLUE-M",
        reason="GS1 barcode belongs to the variant stock number",
    )
    assert assigned.status == "ASSIGNED"
    assert assigned.variant_id == variant.id
    assert assigned.item_id == item.id

    with pytest.raises(ValueError, match="Only UNASSIGNED"):
        await BarcodeRegistryService.assign(
            db_session, "COMP-GS1-A", "BR-GS1-A", "user-gs1", record.id,
            variant_sku="STYLE-GS1-001-BLUE-M",
        )

    with pytest.raises(ValueError, match="already exists"):
        await BarcodeRegistryService.intake(
            db_session, "COMP-GS1-A", "BR-GS1-A", "user-gs1", "8901234567890",
            "EAN13", "GS1_IMPORT", None,
        )


@pytest.mark.asyncio
async def test_gs1_barcode_cannot_be_resolved_across_tenants(db_session):
    record = await BarcodeRegistryService.intake(
        db_session, "COMP-GS1-A", "BR-GS1-A", "user-gs1", "8901234567891",
        "EAN13", "GS1_IMPORT", None,
    )

    with pytest.raises(LookupError, match="not found"):
        await BarcodeRegistryService.assign(
            db_session, "COMP-GS1-B", "BR-GS1-B", "user-other-tenant", record.id,
            item_code="STYLE-GS1-001",
        )