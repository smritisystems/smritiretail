"""NIC E-Way Bill API v1.03 payload construction and validation."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Mapping

from app.compliance.exceptions import PolicyViolationException


def _money(value: Any) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01")))


def _required(request: Mapping[str, Any], name: str) -> Any:
    value = request.get(name)
    if value is None or value == "":
        raise PolicyViolationException(f"SGIP-EWB-VAL-001: {name} is required for NIC v1.03.")
    return value


def build_generate_payload(request: Mapping[str, Any]) -> dict[str, Any]:
    """Map the canonical SMRITI request to NIC's unencrypted GENEWAYBILL data."""
    items = request.get("items") or []
    if not items:
        raise PolicyViolationException("SGIP-EWB-VAL-002: At least one goods item is required.")
    if len(items) > 250:
        raise PolicyViolationException("SGIP-EWB-VAL-003: NIC permits at most 250 items per E-Way Bill.")

    document_date = request.get("document_date") or date.today()
    if isinstance(document_date, date):
        document_date = document_date.strftime("%d/%m/%Y")

    payload: dict[str, Any] = {
        "supplyType": request.get("supply_type", "O"),
        "subSupplyType": str(request.get("sub_supply_type", "1")),
        "subSupplyDesc": request.get("sub_supply_desc", ""),
        "docType": request.get("doc_type", "INV"),
        "docNo": _required(request, "doc_no"),
        "docDate": document_date,
        "fromGstin": _required(request, "from_gstin"),
        "fromTrdName": request.get("from_trade_name", ""),
        "fromAddr1": request.get("from_addr1", ""),
        "fromAddr2": request.get("from_addr2", ""),
        "fromPlace": request.get("from_place", ""),
        "fromPincode": int(_required(request, "from_pincode")),
        "fromStateCode": int(_required(request, "from_state_code")),
        "actFromStateCode": int(request.get("actual_from_state_code", request["from_state_code"])),
        "toGstin": request.get("to_gstin", "URP"),
        "toTrdName": request.get("to_trade_name", ""),
        "toAddr1": request.get("to_addr1", ""),
        "toAddr2": request.get("to_addr2", ""),
        "toPlace": request.get("to_place", ""),
        "toPincode": int(_required(request, "to_pincode")),
        "toStateCode": int(_required(request, "to_state_code")),
        "actToStateCode": int(request.get("actual_to_state_code", request["to_state_code"])),
        "transactionType": int(request.get("transaction_type", request.get("trans_type", 1))),
        "otherValue": _money(request.get("other_value")),
        "totalValue": _money(request.get("total_taxable_amount")),
        "totInvValue": _money(_required(request, "total_invoice_value")),
        "cgstValue": _money(request.get("cgst_amount")),
        "sgstValue": _money(request.get("sgst_amount")),
        "igstValue": _money(request.get("igst_amount")),
        "cessValue": _money(request.get("cess_amount")),
        "cessNonAdvolValue": _money(request.get("cess_non_advol_value")),
        "transMode": str(request.get("trans_mode", "1")),
        "transDistance": str(_required(request, "trans_distance_km")),
        "transporterId": request.get("transporter_id", "") or "",
        "transporterName": request.get("transporter_name", "") or "",
        "transDocNo": request.get("trans_doc_no", "") or "",
        "transDocDate": request.get("trans_doc_date", "") or "",
        "vehicleNo": request.get("vehicle_no", "") or "",
        "vehicleType": request.get("vehicle_type", "R") or "R",
        "itemList": [
            {
                "productName": item.get("product_name", ""),
                "productDesc": item.get("product_desc", ""),
                "hsnCode": int(_required(item, "hsn_code")),
                "quantity": float(item.get("quantity", 0)),
                "qtyUnit": item.get("qty_unit", "NOS"),
                "taxableAmount": _money(_required(item, "taxable_amount")),
                "cgstRate": float(item.get("cgst_rate", 0)),
                "sgstRate": float(item.get("sgst_rate", 0)),
                "igstRate": float(item.get("igst_rate", 0)),
                "cessRate": float(item.get("cess_rate", 0)),
                "cessNonAdvol": float(item.get("cess_non_advol", 0)),
            }
            for item in items
        ],
    }

    if payload["transMode"] == "1" and not payload["vehicleNo"]:
        raise PolicyViolationException("SGIP-EWB-VAL-004: Vehicle number is required for road transport.")
    if payload["transMode"] in {"2", "3", "4"} and not payload["transDocNo"]:
        raise PolicyViolationException("SGIP-EWB-VAL-005: Transport document number is required for non-road transport.")
    return payload


def build_action_request(action: str, encrypted_data: str) -> dict[str, str]:
    """Build the NIC v1.03 action/data envelope."""
    if not action or not encrypted_data:
        raise PolicyViolationException("SGIP-EWB-VAL-006: NIC action and encrypted data are required.")
    return {"action": action, "data": encrypted_data}