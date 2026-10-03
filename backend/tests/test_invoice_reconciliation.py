from app.core.invoice_reconciliation import classify_invoice_reconciliation


def test_matching_invoice_and_current_master_data_requires_no_action():
    invoice = {
        "customer_gstin": "09AABCR1718E1ZL",
        "place_of_supply_code": "09",
        "delivery_store_code": "GK01-SHIP",
        "delivery_location_snapshot": {"store_code": "GK01-SHIP"},
    }

    result = classify_invoice_reconciliation(
        invoice,
        registration={"gstin": "09AABCR1718E1ZL", "state_code": "09"},
        delivery_location={"store_code": "GK01-SHIP", "state_code": "09"},
    )

    assert result["classification"] == "NO_ACTION"
    assert result["issues"] == []
    assert invoice["customer_gstin"] == "09AABCR1718E1ZL"


def test_current_master_drift_is_not_treated_as_invoice_mutation():
    invoice = {
        "customer_gstin": "29AABCR1718E1ZL",
        "place_of_supply_code": "29",
        "delivery_store_code": "KA01",
        "billing_store_code": "KA-BILL",
        "delivery_location_snapshot": {"store_code": "KA01"},
        "po_reference": "PO-104",
    }
    result = classify_invoice_reconciliation(
        invoice,
        registration={"gstin": "09AABCR1718E1ZL", "state_code": "09"},
        delivery_location={"store_code": "UP01", "state_code": "09"},
    )

    assert result["classification"] == "MASTER_DATA_DRIFT"
    assert "CURRENT_GST_REGISTRATION_DIFFERS" in result["issues"]
    assert "CURRENT_DELIVERY_LOCATION_DIFFERS" in result["issues"]
    assert invoice == {
        "customer_gstin": "29AABCR1718E1ZL",
        "place_of_supply_code": "29",
        "delivery_store_code": "KA01",
        "billing_store_code": "KA-BILL",
        "delivery_location_snapshot": {"store_code": "KA01"},
        "po_reference": "PO-104",
    }


def test_missing_historical_snapshot_requires_source_document_review():
    result = classify_invoice_reconciliation(
        {
            "customer_gstin": None,
            "place_of_supply_code": None,
            "delivery_store_code": "GK01-SHIP",
            "delivery_location_snapshot": None,
        }
    )

    assert result["classification"] == "HISTORICAL_DATA_GAP"
    assert "MISSING_HISTORICAL_GST_CONTEXT" in result["issues"]
    assert "MISSING_DELIVERY_LOCATION_SNAPSHOT" in result["issues"]