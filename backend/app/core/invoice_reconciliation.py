"""Read-only classification for historical invoice master-data drift."""

from typing import Any, Mapping, Optional


def _value(source: Optional[Mapping[str, Any]], *keys: str) -> Optional[str]:
    if not source:
        return None
    for key in keys:
        value = source.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def classify_invoice_reconciliation(
    invoice: Mapping[str, Any],
    registration: Optional[Mapping[str, Any]] = None,
    billing_location: Optional[Mapping[str, Any]] = None,
    delivery_location: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Compare immutable invoice values with current master data without mutating either."""
    issues: list[str] = []
    snapshot = invoice.get("delivery_location_snapshot") or {}
    historical_gstin = _value(invoice, "delivery_gstin", "customer_gstin")
    historical_pos = _value(invoice, "place_of_supply_code", "pos_state")
    historical_billing_store = _value(invoice, "billing_store_code")
    historical_delivery_store = _value(invoice, "delivery_store_code") or _value(snapshot, "store_code", "delivery_store_code")
    current_gstin = _value(registration, "gstin")
    current_billing_store = _value(billing_location, "billing_store_code", "billingStoreCode")
    current_delivery_store = _value(delivery_location, "store_code", "storeCode")
    current_state_code = _value(delivery_location, "state_code", "stateCode") or _value(registration, "state_code", "stateCode")

    if not historical_gstin and not historical_pos:
        issues.append("MISSING_HISTORICAL_GST_CONTEXT")
    if not snapshot and historical_delivery_store:
        issues.append("MISSING_DELIVERY_LOCATION_SNAPSHOT")
    if registration and historical_gstin and current_gstin and historical_gstin.upper() != current_gstin.upper():
        issues.append("CURRENT_GST_REGISTRATION_DIFFERS")
    if billing_location and historical_billing_store and current_billing_store and historical_billing_store.upper() != current_billing_store.upper():
        issues.append("CURRENT_BILLING_LOCATION_DIFFERS")
    if delivery_location and historical_delivery_store and current_delivery_store and historical_delivery_store.upper() != current_delivery_store.upper():
        issues.append("CURRENT_DELIVERY_LOCATION_DIFFERS")
    if current_state_code and historical_pos and current_state_code.zfill(2) != historical_pos.zfill(2):
        issues.append("CURRENT_STATE_DIFFERS")

    if any(issue.startswith("MISSING_") for issue in issues):
        classification = "HISTORICAL_DATA_GAP"
        action = "Review the original invoice PDF and source documents; do not rewrite the posted invoice."
    elif issues:
        classification = "MASTER_DATA_DRIFT"
        action = "Repair current customer/location master data only; use an approved tax correction document if the posted invoice is legally wrong."
    else:
        classification = "NO_ACTION"
        action = "No reconciliation action indicated."

    return {
        "classification": classification,
        "issues": issues,
        "recommended_action": action,
        "historical_gstin": historical_gstin,
        "historical_pos_code": historical_pos,
        "historical_billing_store_code": historical_billing_store,
        "historical_delivery_store_code": historical_delivery_store,
        "current_gstin": current_gstin,
        "current_billing_store_code": current_billing_store,
        "current_delivery_store_code": current_delivery_store,
    }