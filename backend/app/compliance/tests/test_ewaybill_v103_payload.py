import pytest

from app.compliance.connectors.ewaybill.payloads import build_action_request, build_generate_payload
from app.compliance.exceptions import PolicyViolationException
from app.compliance.api.router import EWayBillManagementFilter, _nic_payload_from_export


def _request(**overrides):
    request = {
        "doc_no": "INV-001",
        "from_gstin": "27AABCU9603R1ZM",
        "from_pincode": "400001",
        "from_state_code": 27,
        "to_gstin": "29BBBCU9603F1Z5",
        "to_pincode": "560001",
        "to_state_code": 29,
        "trans_distance_km": 350,
        "total_invoice_value": 118000,
        "total_taxable_amount": 100000,
        "vehicle_no": "MH12AB1234",
        "items": [{"hsn_code": "6203", "taxable_amount": 100000, "quantity": 10}],
    }
    request.update(overrides)
    return request


def test_build_generate_payload_matches_nic_v103_shape():
    payload = build_generate_payload(_request())

    assert payload["docDate"]
    assert payload["fromStateCode"] == 27
    assert payload["toStateCode"] == 29
    assert payload["transactionType"] == 1
    assert payload["transMode"] == "1"
    assert payload["itemList"][0]["hsnCode"] == 6203
    assert payload["itemList"][0]["taxableAmount"] == 100000.0


def test_build_generate_payload_rejects_more_than_250_items():
    with pytest.raises(PolicyViolationException, match="at most 250"):
        build_generate_payload(_request(items=[{"hsn_code": "6203", "taxable_amount": 1}] * 251))


def test_build_generate_payload_requires_transport_document_for_non_road():
    with pytest.raises(PolicyViolationException, match="Transport document"):
        build_generate_payload(_request(trans_mode="2", vehicle_no="", trans_doc_no=""))


def test_build_action_request_uses_nic_action_data_envelope():
    assert build_action_request("GENEWAYBILL", "encrypted") == {
        "action": "GENEWAYBILL",
        "data": "encrypted",
    }


def test_management_filter_supports_date_and_bill_range_modes():
    date_filter = EWayBillManagementFilter(mode="date_range", date_from="2026-09-01", date_to="2026-09-15")
    bill_filter = EWayBillManagementFilter(mode="bill_range", bill_from="TT/18", bill_to="TT/137")
    assert date_filter.mode == "date_range"
    assert bill_filter.mode == "bill_range"


def test_management_export_is_converted_to_nic_inner_json():
    payload = _nic_payload_from_export({
        "billLists": [{
            "supplyType": "O", "subSupplyType": 1, "docType": "INV", "docNo": "INV-1", "docDate": "15/09/2026",
            "fromGstin": "27AABCU9603R1ZM", "fromPincode": 400001, "fromStateCode": 27, "actFromStateCode": 27,
            "toGstin": "29BBBCU9603F1Z5", "toPincode": 560001, "toStateCode": 29, "actToStateCode": 29,
            "totInvValue": 118000, "totalValue": 100000, "transMode": "1", "transDistance": 350,
            "vehicleNo": "MH12AB1234", "itemList": [{"hsnCode": 6203, "taxableAmount": 100000}],
        }]
    })
    assert payload["docNo"] == "INV-1"
    assert payload["itemList"][0]["hsnCode"] == 6203