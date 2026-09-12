from app.services.size_groups import normalize_size_group_payload


def test_normalize_size_group_payload_converts_registry_values():
    payload = {
        "code": "APPAREL_ALPHA",
        "name": "Apparel Alpha",
        "data": {
            "category": "APPAREL",
            "dimension": "size",
            "values": ["XS", "S", "M", "L", "XL"],
            "description": "Core apparel sizing",
        },
    }

    normalized = normalize_size_group_payload(payload)

    assert normalized["code"] == "APPAREL_ALPHA"
    assert normalized["name"] == "Apparel Alpha"
    assert normalized["category"] == "APPAREL"
    assert normalized["dimension"] == "size"
    assert normalized["values"] == ["XS", "S", "M", "L", "XL"]
    assert normalized["description"] == "Core apparel sizing"
