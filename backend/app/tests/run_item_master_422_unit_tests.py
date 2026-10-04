"""
Standalone runner for Item Master 422 Validation mapper unit tests.
Runs independently of conftest.py and requires no live database connection.

Run with:
    .venv\Scripts\python.exe backend/app/tests/run_item_master_422_unit_tests.py
"""
import sys
import os

# Ensure backend/ is on the path so `app.*` imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# Minimal env stubs (no DB connection needed for mapper unit tests)
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://stub:stub@localhost/stub")
os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "CF511BC0139A3F1AF43D6B76639E933983B187C8ECBEE080F540C943E0CDB40A")

# ─────────────────────────────────────────────────────────────────────────────

import re
import traceback

PASS = "PASS"
FAIL = "FAIL"

results = []

def run(name: str, fn):
    try:
        fn()
        results.append((name, True, None))
        print(f"  {PASS}  {name}")
    except Exception as e:
        results.append((name, False, str(e)))
        print(f"  {FAIL}  {name}")
        print(f"          {e}")

# ─── Import mapper ────────────────────────────────────────────────────────────
from app.core.item_master_validation import (
    ItemMasterValidationMapper,
    is_item_master_endpoint,
    FIELD_LABELS,
    FIELD_SECTIONS,
)

FORBIDDEN = ["pydantic", "fastapi", "sqlalchemy", "traceback", "exception",
             "422 unprocessable", "unprocessable entity", "validation error",
             "value_error", "type_error"]

def is_human(msg: str) -> bool:
    ml = msg.lower()
    return not any(f in ml for f in FORBIDDEN)

def make_err(loc, msg, type_="value_error"):
    return {"loc": loc, "msg": msg, "type": type_}

# ─── GROUP 1: Missing required fields ────────────────────────────────────────
print("\n[Group 1] Missing required fields")

def t_missing_sku():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","code"), "field required", "missing")])
    assert r["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
    f = r["error"]["fields"][0]
    assert f["field"] == "code"
    assert "SKU" in f["message"] or "Item Code" in f["message"]
    assert is_human(f["message"]), f["message"]
run("Missing SKU / Item Code", t_missing_sku)

def t_missing_brand():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","brand"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "Brand" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing Brand", t_missing_brand)

def t_missing_category():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","category"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "Category" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing Category", t_missing_category)

def t_missing_name():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","name"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "Product Name" in f["message"] or "Name" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing Product Name", t_missing_name)

def t_missing_article():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","style_code"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert any(k in f["message"] for k in ["Article","Design","Style","Model"]); assert is_human(f["message"]), f["message"]
run("Missing Article / Design / Style / Model", t_missing_article)

def t_missing_colour():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","color"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert any(k in f["message"] for k in ["Colour","Color","Shade"]); assert is_human(f["message"]), f["message"]
run("Missing Colour / Shade", t_missing_colour)

def t_missing_size_system():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","size_system"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "Size System" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing Size System", t_missing_size_system)

def t_missing_size():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","size"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "Size" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing Size", t_missing_size)

# ─── GROUP 2: HSN Code ────────────────────────────────────────────────────────
print("\n[Group 2] HSN Code validation")

def t_missing_hsn():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","hsn_code"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "HSN" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing HSN Code", t_missing_hsn)

def t_invalid_hsn_format():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","hsn_code"), "HSN Code must contain a valid 6 or 8 digit value.", "value_error")])
    f = r["error"]["fields"][0]
    assert "6 or 8 digit" in f["message"]; assert is_human(f["message"]), f["message"]
run("Invalid HSN format — 6 or 8 digit message", t_invalid_hsn_format)

def t_hsn_schema_valid_6digit():
    from app.schemas.inventory import ProductBase
    obj = ProductBase(code="TEST001", name="Test Product", price="2999", mrp="2999",
                       barcode="8901234567890", gst_percentage="12", hsn_code="640319")
    assert obj.hsn_code == "640319"
run("HSN schema accepts valid 6-digit value", t_hsn_schema_valid_6digit)

def t_hsn_schema_valid_8digit():
    from app.schemas.inventory import ProductBase
    obj = ProductBase(code="TEST002", name="Test Product", price="2999", mrp="2999",
                       barcode="8901234567891", gst_percentage="12", hsn_code="64031990")
    assert obj.hsn_code == "64031990"
run("HSN schema accepts valid 8-digit value", t_hsn_schema_valid_8digit)

def t_hsn_schema_rejects_invalid():
    from app.schemas.inventory import ProductBase
    from pydantic import ValidationError
    try:
        ProductBase(code="TEST003", name="Test Product", price="2999", mrp="2999",
                    barcode="8901234567892", gst_percentage="12", hsn_code="ABC123")
        raise AssertionError("Should have raised ValidationError")
    except ValidationError as exc:
        assert "6 or 8 digit" in str(exc)
run("HSN schema rejects non-numeric value", t_hsn_schema_rejects_invalid)

def t_hsn_schema_accepts_legacy_0000():
    from app.schemas.inventory import ProductBase
    obj = ProductBase(code="TEST004", name="Test Product", price="2999", mrp="2999",
                       barcode="8901234567893", gst_percentage="12", hsn_code="0000")
    assert obj.hsn_code == "0000"
run("HSN schema accepts legacy placeholder '0000'", t_hsn_schema_accepts_legacy_0000)

# ─── GROUP 3: Price / MRP / GST ──────────────────────────────────────────────
print("\n[Group 3] Retail Price / GST validation")

def t_price_zero():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","price"), "ensure this value is greater than 0", "value_error.number.not_gt")])
    f = r["error"]["fields"][0]
    assert "greater than 0" in f["message"] or "Retail Price" in f["message"]; assert is_human(f["message"]), f["message"]
run("Invalid Retail Price — greater than 0 message", t_price_zero)

def t_gst_invalid():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","gst_percentage"), "value is not a valid decimal", "type_error.decimal")])
    f = r["error"]["fields"][0]
    assert "GST" in f["message"]; assert is_human(f["message"]), f["message"]
run("Invalid GST — GST in message", t_gst_invalid)

def t_mrp_missing():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","mrp"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "MRP" in f["message"] or "Retail Price" in f["message"]; assert is_human(f["message"]), f["message"]
run("Missing MRP — Retail Price in message", t_mrp_missing)

# ─── GROUP 4: Duplicate values ────────────────────────────────────────────────
print("\n[Group 4] Duplicate values")

def t_duplicate_sku():
    r = ItemMasterValidationMapper.build_duplicate_sku_response("FT00123BLK08")
    assert r["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
    assert r["error"]["status"] == 422
    f = r["error"]["fields"][0]
    assert f["field"] == "code"
    assert "FT00123BLK08" in f["message"]
    assert "already exists" in f["message"]
    assert "unique SKU" in f["message"]
    assert is_human(f["message"]), f["message"]
run("Duplicate SKU response", t_duplicate_sku)

def t_duplicate_barcode():
    r = ItemMasterValidationMapper.build_duplicate_barcode_response("8901234567890")
    f = r["error"]["fields"][0]
    assert f["field"] == "barcode"
    assert "8901234567890" in f["message"]
    assert "already assigned" in f["message"]
    assert is_human(f["message"]), f["message"]
run("Duplicate Barcode response", t_duplicate_barcode)

# ─── GROUP 5: Multiple simultaneous errors ────────────────────────────────────
print("\n[Group 5] Multiple simultaneous errors")

def t_multiple_errors():
    errors = [
        make_err(("body","code"),    "field required", "missing"),
        make_err(("body","name"),    "field required", "missing"),
        make_err(("body","brand"),   "field required", "missing"),
        make_err(("body","category"),"field required", "missing"),
        make_err(("body","mrp"),     "field required", "missing"),
    ]
    r = ItemMasterValidationMapper.build_422_response(errors)
    fields = r["error"]["fields"]
    assert len(fields) == 5
    assert "5" in r["error"]["message"]
    for f in fields:
        assert is_human(f["message"]), f"Technical text in field '{f['field']}': {f['message']}"
run("5 simultaneous errors — all human-readable", t_multiple_errors)

def t_deduplication():
    errors = [
        make_err(("body","code"), "field required", "missing"),
        make_err(("body","code"), "str type expected", "type_error.str"),
    ]
    r = ItemMasterValidationMapper.build_422_response(errors)
    assert len(r["error"]["fields"]) == 1, "Duplicate field errors should be collapsed"
run("Deduplication — same field yields single error", t_deduplication)

# ─── GROUP 6: Nested dot-notation ─────────────────────────────────────────────
print("\n[Group 6] Nested field validation")

def t_nested_variant_colour():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","variants",0,"color"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert f["field"] == "variant.color"
    assert any(k in f["message"] for k in ["Colour","Color","Shade"])
    assert is_human(f["message"]), f["message"]
run("variant.color nested dot-notation", t_nested_variant_colour)

def t_nested_variant_size():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","variants",0,"size"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert f["field"] == "variant.size"
    assert "Size" in f["message"]
run("variant.size nested dot-notation", t_nested_variant_size)

def t_nested_pricing_mrp():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","pricing","retail_price"), "ensure this value is greater than 0", "value_error")])
    f = r["error"]["fields"][0]
    assert f["field"] == "pricing.retail_price"
    assert "Retail Price" in f["message"] or "MRP" in f["message"]
    assert is_human(f["message"]), f["message"]
run("pricing.retail_price nested dot-notation", t_nested_pricing_mrp)

# ─── GROUP 7: Unknown field ────────────────────────────────────────────────────
print("\n[Group 7] Unknown field handling")

def t_unknown_field():
    r = ItemMasterValidationMapper.build_422_response([make_err(
        ("body","some_internal_system_field"),
        "value_error.missing unexpected internal constraint violated",
        "value_error"
    )])
    f = r["error"]["fields"][0]
    # Must not expose raw pydantic/internal text
    assert "value_error" not in f["message"].lower() or len(f["message"]) > 5, f"Raw technical text in: {f['message']!r}"
    assert "internal constraint" not in f["message"].lower(), f"Internal text leaked: {f['message']!r}"
    # Must be human-readable (even if it's a fallback message)
    assert is_human(f["message"]), f"Technical text in: {f['message']!r}"
    # Must not be empty
    assert len(f["message"].strip()) > 0, "Message should not be empty"
run("Unknown field - no raw Pydantic text in message", t_unknown_field)

# ─── GROUP 8: Endpoint matcher ────────────────────────────────────────────────
print("\n[Group 8] Endpoint matcher")

def t_inventory_matches():
    assert is_item_master_endpoint("/api/v1/inventory/") is True
    assert is_item_master_endpoint("/api/v1/inventory") is True
run("/api/v1/inventory matches", t_inventory_matches)

def t_item_styles_matches():
    assert is_item_master_endpoint("/api/v1/item-styles") is True
run("/api/v1/item-styles matches", t_item_styles_matches)

def t_universal_items_matches():
    assert is_item_master_endpoint("/api/v1/universal/items") is True
    assert is_item_master_endpoint("/api/v1/universal/items/abc-123/variants") is True
run("/api/v1/universal/items matches", t_universal_items_matches)

def t_sales_does_not_match():
    assert is_item_master_endpoint("/api/v1/sales/") is False
run("/api/v1/sales does NOT match", t_sales_does_not_match)

def t_auth_does_not_match():
    assert is_item_master_endpoint("/api/v1/auth/login") is False
run("/api/v1/auth does NOT match", t_auth_does_not_match)

# ─── GROUP 9: Schema-level messages in ProductBase ────────────────────────────
print("\n[Group 9] ProductBase schema human-readable messages")

def t_sku_blank_schema_message():
    from app.schemas.inventory import ProductBase
    from pydantic import ValidationError
    try:
        ProductBase(code="", name="Test", price="999", mrp="999", barcode="1234567890", gst_percentage="12")
        raise AssertionError("Should have raised")
    except ValidationError as exc:
        errors = exc.errors()
        code_errs = [e for e in errors if "code" in str(e.get("loc", ""))]
        assert len(code_errs) > 0
        msg = code_errs[0]["msg"]
        assert "SKU" in msg or "Item Code" in msg, f"Not human-readable: {msg}"
        assert is_human(msg), f"Technical text: {msg}"
run("ProductBase: blank SKU - human-readable error", t_sku_blank_schema_message)

def t_stock_not_required():
    from app.schemas.inventory import ProductCreate
    obj = ProductCreate(code="ART-TEST-100", name="Test Product", price="2999", mrp="2999",
                         barcode="8901234500001", gst_percentage="12")
    assert obj.stock == 0, "Stock must default to 0, not be required"
run("Stock NOT required during product creation - defaults to 0", t_stock_not_required)

def t_mrp_none_schema_message():
    from app.schemas.inventory import ProductBase
    from pydantic import ValidationError
    try:
        ProductBase(code="ART001", name="Test", price="999", mrp=None, barcode="1234567890", gst_percentage="12")
        raise AssertionError("Should have raised")
    except ValidationError as exc:
        errors = exc.errors()
        mrp_errs = [e for e in errors if "mrp" in str(e.get("loc", ""))]
        assert len(mrp_errs) > 0
        msg = mrp_errs[0]["msg"]
        assert "Retail Price" in msg or "MRP" in msg, f"Not human-readable: {msg}"
run("ProductBase: mrp=None - human-readable error", t_mrp_none_schema_message)

def t_gst_none_schema_message():
    from app.schemas.inventory import ProductBase
    from pydantic import ValidationError
    try:
        ProductBase(code="ART001", name="Test", price="999", mrp="999", barcode="1234567890", gst_percentage=None)
        raise AssertionError("Should have raised")
    except ValidationError as exc:
        errors = exc.errors()
        gst_errs = [e for e in errors if "gst_percentage" in str(e.get("loc", ""))]
        assert len(gst_errs) > 0
        msg = gst_errs[0]["msg"]
        assert "GST" in msg, f"Not human-readable: {msg}"
run("ProductBase: gst_percentage=None - human-readable error", t_gst_none_schema_message)

# ─── GROUP 10: Structured response contract ───────────────────────────────────
print("\n[Group 10] Structured response contract")

def t_required_keys():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","code"), "field required", "missing")])
    assert "error" in r
    e = r["error"]
    assert e["code"] == "ITEM_MASTER_VALIDATION_ERROR"
    assert e["status"] == 422
    assert "message" in e
    assert "fields" in e
    assert isinstance(e["fields"], list)
run("Response has all required top-level keys", t_required_keys)

def t_field_has_section():
    r = ItemMasterValidationMapper.build_422_response([make_err(("body","brand"), "field required", "missing")])
    f = r["error"]["fields"][0]
    assert "section" in f
    assert f["section"] == "Basic Information"
run("Known fields include section key", t_field_has_section)

def t_summary_contains_count():
    errors = [make_err(("body","code"), "field required", "missing"), make_err(("body","brand"), "field required", "missing")]
    r = ItemMasterValidationMapper.build_422_response(errors)
    assert "2" in r["error"]["message"]
    assert "field" in r["error"]["message"]
run("Summary message contains error count", t_summary_contains_count)

# ─────────────────────────────────────────────────────────────────────────────
# Final summary
# ─────────────────────────────────────────────────────────────────────────────
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
failed = total - passed

print(f"\n{'='*60}")
print(f"Results: {passed}/{total} passed, {failed} failed")
if failed:
    print("\nFailed tests:")
    for name, ok, err in results:
        if not ok:
            print(f"  FAIL  {name}: {err}")
    sys.exit(1)
else:
    print("All tests passed.")
    sys.exit(0)
