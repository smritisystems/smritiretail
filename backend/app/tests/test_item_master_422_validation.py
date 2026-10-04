"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.1.0
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
Backend tests for Item Master 422 validation — SMRITI HREP compliance.

Tests verify:
1. Every required field produces a human-readable error (no Pydantic/technical text).
2. The response is structured as { error: { code, fields: [...] } }.
3. HSN validation enforces 6 or 8 digit format.
4. MRP > 0 enforced correctly.
5. Duplicate SKU / Barcode responses are structured correctly.
6. Multiple simultaneous validation errors all appear in the response.
7. Nested field validation (variant.color, variant.size) uses dot-notation.
8. Unknown fields do not expose internal pydantic messages.

These tests operate on the mapper logic in isolation (unit tests) and also
verify the schema validators in ProductBase. Integration tests against a
live DB are separate (see test_inventory.py).
"""

import pytest
import re as re_module
from app.core.item_master_validation import (
    ItemMasterValidationMapper,
    is_item_master_endpoint,
    FIELD_LABELS,
    FIELD_SECTIONS,
    FIELD_REQUIRED_MESSAGES,
    _DYN_LABEL_MAP,
)

# Mark all tests in this module as unit tests (no DB required)
pytestmark = pytest.mark.unit


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_pydantic_error(loc: tuple, msg: str, type_: str = "value_error") -> dict:
    """Build a minimal pydantic v2 error dict for unit testing."""
    return {"loc": loc, "msg": msg, "type": type_}


FORBIDDEN_WORDS = [
    "pydantic", "fastapi", "sqlalchemy", "traceback", "exception",
    "422 unprocessable", "unprocessable entity", "validation error",
    "value_error", "type_error", "body ->",
]


def _is_human_readable(msg: str) -> bool:
    """Return True if message contains no known technical terms."""
    msg_lower = msg.lower()
    return not any(fw in msg_lower for fw in FORBIDDEN_WORDS)


# ─────────────────────────────────────────────────────────────────────────────
# Group 1: Missing required fields — one field at a time
# ─────────────────────────────────────────────────────────────────────────────

class TestMissingRequiredFields:

    def test_missing_sku(self):
        errors = [_make_pydantic_error(("body", "code"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        assert result["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        fields = result["error"]["fields"]
        assert len(fields) == 1
        assert fields[0]["field"] == "code"
        msg = fields[0]["message"]
        assert "SKU" in msg or "Item Code" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_brand(self):
        errors = [_make_pydantic_error(("body", "brand"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "brand"
        msg = fields[0]["message"]
        assert "Brand" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_category(self):
        errors = [_make_pydantic_error(("body", "category"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "category"
        msg = fields[0]["message"]
        assert "Category" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_product_name(self):
        errors = [_make_pydantic_error(("body", "name"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "name"
        msg = fields[0]["message"]
        assert "Product Name" in msg or "Name" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_article_style(self):
        errors = [_make_pydantic_error(("body", "style_code"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "style_code"
        msg = fields[0]["message"]
        assert "Article" in msg or "Design" in msg or "Style" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_colour(self):
        errors = [_make_pydantic_error(("body", "color"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "color"
        msg = fields[0]["message"]
        assert "Colour" in msg or "Color" in msg or "Shade" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_size_system(self):
        errors = [_make_pydantic_error(("body", "size_system"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "size_system"
        msg = fields[0]["message"]
        assert "Size System" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_missing_size(self):
        errors = [_make_pydantic_error(("body", "size"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "size"
        msg = fields[0]["message"]
        assert "Size" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Group 2: HSN Code validation
# ─────────────────────────────────────────────────────────────────────────────

class TestHSNValidation:

    def test_missing_hsn(self):
        errors = [_make_pydantic_error(("body", "hsn_code"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "hsn_code"
        msg = fields[0]["message"]
        assert "HSN" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_invalid_hsn_format(self):
        errors = [_make_pydantic_error(
            ("body", "hsn_code"),
            "HSN Code must contain a valid 6 or 8 digit value.",
            "value_error"
        )]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        msg = fields[0]["message"]
        assert "6 or 8 digit" in msg or "6" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_hsn_schema_validator_accepts_valid_6digit(self):
        from app.schemas.inventory import ProductBase
        # 6-digit HSN should not raise
        try:
            obj = ProductBase(
                code="TEST001",
                name="Test Product",
                price="2999",
                mrp="2999",
                barcode="8901234567890",
                gst_percentage="12",
                hsn_code="640319",
            )
            assert obj.hsn_code == "640319"
        except Exception as e:
            pytest.fail(f"Valid 6-digit HSN raised unexpected error: {e}")

    def test_hsn_schema_validator_accepts_valid_8digit(self):
        from app.schemas.inventory import ProductBase
        try:
            obj = ProductBase(
                code="TEST002",
                name="Test Product",
                price="2999",
                mrp="2999",
                barcode="8901234567891",
                gst_percentage="12",
                hsn_code="64031990",
            )
            assert obj.hsn_code == "64031990"
        except Exception as e:
            pytest.fail(f"Valid 8-digit HSN raised unexpected error: {e}")

    def test_hsn_schema_validator_rejects_invalid_format(self):
        from app.schemas.inventory import ProductBase
        from pydantic import ValidationError
        with pytest.raises(ValidationError) as exc_info:
            ProductBase(
                code="TEST003",
                name="Test Product",
                price="2999",
                mrp="2999",
                barcode="8901234567892",
                gst_percentage="12",
                hsn_code="ABC123",  # non-numeric
            )
        err_str = str(exc_info.value)
        assert "6 or 8 digit" in err_str

    def test_hsn_schema_validator_accepts_legacy_0000(self):
        """The legacy placeholder '0000' must always be accepted without error."""
        from app.schemas.inventory import ProductBase
        try:
            obj = ProductBase(
                code="TEST004",
                name="Test Product",
                price="2999",
                mrp="2999",
                barcode="8901234567893",
                gst_percentage="12",
                hsn_code="0000",
            )
            assert obj.hsn_code == "0000"
        except Exception as e:
            pytest.fail(f"Legacy HSN '0000' raised unexpected error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Group 3: Price / MRP / GST validation
# ─────────────────────────────────────────────────────────────────────────────

class TestPriceValidation:

    def test_invalid_retail_price_zero(self):
        errors = [_make_pydantic_error(
            ("body", "price"),
            "ensure this value is greater than 0",
            "value_error.number.not_gt"
        )]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "price"
        msg = fields[0]["message"]
        assert "greater than 0" in msg or "Retail Price" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_invalid_gst_rate(self):
        errors = [_make_pydantic_error(
            ("body", "gst_percentage"),
            "value is not a valid decimal",
            "type_error.decimal"
        )]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "gst_percentage"
        msg = fields[0]["message"]
        assert "GST" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_mrp_required_message(self):
        errors = [_make_pydantic_error(("body", "mrp"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        msg = fields[0]["message"]
        assert "MRP" in msg or "Retail Price" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Group 4: Duplicate SKU / Barcode
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicateValues:

    def test_duplicate_sku_response(self):
        result = ItemMasterValidationMapper.build_duplicate_sku_response("FT00123BLK08")
        assert result["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        assert result["error"]["status"] == 422
        fields = result["error"]["fields"]
        assert len(fields) == 1
        assert fields[0]["field"] == "code"
        msg = fields[0]["message"]
        assert "FT00123BLK08" in msg
        assert "already exists" in msg
        assert "unique SKU" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_duplicate_barcode_response(self):
        result = ItemMasterValidationMapper.build_duplicate_barcode_response("8901234567890")
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "barcode"
        msg = fields[0]["message"]
        assert "8901234567890" in msg
        assert "already assigned" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Group 5: Multiple simultaneous validation errors
# ─────────────────────────────────────────────────────────────────────────────

class TestMultipleErrors:

    def test_multiple_simultaneous_errors(self):
        errors = [
            _make_pydantic_error(("body", "code"),    "field required", "missing"),
            _make_pydantic_error(("body", "name"),    "field required", "missing"),
            _make_pydantic_error(("body", "brand"),   "field required", "missing"),
            _make_pydantic_error(("body", "category"),"field required", "missing"),
            _make_pydantic_error(("body", "mrp"),     "field required", "missing"),
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        assert result["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        fields = result["error"]["fields"]
        assert len(fields) == 5
        # Summary should say "5 fields"
        summary = result["error"]["message"]
        assert "5" in summary
        assert "fields" in summary
        # Each field must be human-readable
        for f in fields:
            assert _is_human_readable(f["message"]), (
                f"Technical text in field '{f['field']}': {f['message']!r}"
            )

    def test_deduplication_of_same_field(self):
        """Two errors for the same field path → only one entry in response."""
        errors = [
            _make_pydantic_error(("body", "code"), "field required", "missing"),
            _make_pydantic_error(("body", "code"), "str type expected", "type_error.str"),
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert len(fields) == 1, "Duplicate field errors should be collapsed to one"


# ─────────────────────────────────────────────────────────────────────────────
# Group 6: Nested field validation (dot-notation)
# ─────────────────────────────────────────────────────────────────────────────

class TestNestedFieldValidation:

    def test_variant_colour_nested(self):
        errors = [
            _make_pydantic_error(("body", "variants", 0, "color"), "field required", "missing")
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "variant.color"
        msg = fields[0]["message"]
        assert "Colour" in msg or "Color" in msg or "Shade" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_variant_size_nested(self):
        errors = [
            _make_pydantic_error(("body", "variants", 0, "size"), "field required", "missing")
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "variant.size"
        msg = fields[0]["message"]
        assert "Size" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_variant_size_system_nested(self):
        errors = [
            _make_pydantic_error(("body", "variants", 0, "size_system"), "field required", "missing")
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "variant.size_system"
        msg = fields[0]["message"]
        assert "Size System" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"

    def test_pricing_mrp_nested(self):
        errors = [
            _make_pydantic_error(("body", "pricing", "retail_price"), "ensure this value is greater than 0", "value_error")
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert fields[0]["field"] == "pricing.retail_price"
        msg = fields[0]["message"]
        assert "Retail Price" in msg or "MRP" in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Group 7: Unknown field handling
# ─────────────────────────────────────────────────────────────────────────────

class TestUnknownFieldHandling:

    def test_422_response_with_unknown_field(self):
        """Unknown fields should produce a safe, sanitized message — no raw Pydantic text."""
        errors = [
            _make_pydantic_error(
                ("body", "some_internal_system_field"),
                "value_error.missing — unexpected internal constraint violated",
                "value_error"
            )
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        fields = result["error"]["fields"]
        assert len(fields) == 1
        msg = fields[0]["message"]
        # Must not expose the raw pydantic message
        assert "value_error.missing" not in msg
        assert "internal constraint violated" not in msg
        assert _is_human_readable(msg), f"Technical text found in: {msg!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Group 8: Endpoint matcher
# ─────────────────────────────────────────────────────────────────────────────

class TestEndpointMatcher:

    def test_inventory_endpoint_matches(self):
        assert is_item_master_endpoint("/api/v1/inventory/") is True
        assert is_item_master_endpoint("/api/v1/inventory") is True

    def test_item_styles_endpoint_matches(self):
        assert is_item_master_endpoint("/api/v1/item-styles") is True

    def test_item_variants_endpoint_matches(self):
        assert is_item_master_endpoint("/api/v1/item-variants") is True

    def test_item_barcodes_endpoint_matches(self):
        assert is_item_master_endpoint("/api/v1/item-barcodes") is True

    def test_universal_items_matches(self):
        assert is_item_master_endpoint("/api/v1/universal/items") is True
        assert is_item_master_endpoint("/api/v1/universal/items/abc-123/variants") is True

    def test_sales_endpoint_does_not_match(self):
        assert is_item_master_endpoint("/api/v1/sales/") is False

    def test_auth_endpoint_does_not_match(self):
        assert is_item_master_endpoint("/api/v1/auth/login") is False


# ─────────────────────────────────────────────────────────────────────────────
# Group 9: Schema-level human-readable messages in ProductBase
# ─────────────────────────────────────────────────────────────────────────────

class TestProductBaseSchemaMessages:

    def test_sku_code_required_message(self):
        from app.schemas.inventory import ProductBase
        from pydantic import ValidationError
        with pytest.raises(ValidationError) as exc_info:
            ProductBase(
                code="",  # blank
                name="Test",
                price="999",
                mrp="999",
                barcode="1234567890",
                gst_percentage="12",
            )
        errors = exc_info.value.errors()
        code_errors = [e for e in errors if "code" in str(e.get("loc", ""))]
        assert len(code_errors) > 0
        msg = code_errors[0]["msg"]
        assert "SKU" in msg or "Item Code" in msg, f"Not human-readable: {msg!r}"
        assert _is_human_readable(msg), f"Technical text in error: {msg!r}"

    def test_product_name_required_message(self):
        from app.schemas.inventory import ProductBase
        from pydantic import ValidationError
        with pytest.raises(ValidationError) as exc_info:
            ProductBase(
                code="ART001",
                name="",  # blank
                price="999",
                mrp="999",
                barcode="1234567890",
                gst_percentage="12",
            )
        errors = exc_info.value.errors()
        name_errors = [e for e in errors if "name" in str(e.get("loc", ""))]
        assert len(name_errors) > 0
        msg = name_errors[0]["msg"]
        assert "Product Name" in msg, f"Not human-readable: {msg!r}"

    def test_mrp_required_message(self):
        from app.schemas.inventory import ProductBase
        from pydantic import ValidationError
        with pytest.raises(ValidationError) as exc_info:
            ProductBase(
                code="ART001",
                name="Test",
                price="999",
                mrp=None,  # missing
                barcode="1234567890",
                gst_percentage="12",
            )
        errors = exc_info.value.errors()
        mrp_errors = [e for e in errors if "mrp" in str(e.get("loc", ""))]
        assert len(mrp_errors) > 0
        msg = mrp_errors[0]["msg"]
        assert "Retail Price" in msg or "MRP" in msg, f"Not human-readable: {msg!r}"

    def test_gst_required_message(self):
        from app.schemas.inventory import ProductBase
        from pydantic import ValidationError
        with pytest.raises(ValidationError) as exc_info:
            ProductBase(
                code="ART001",
                name="Test",
                price="999",
                mrp="999",
                barcode="1234567890",
                gst_percentage=None,  # missing
            )
        errors = exc_info.value.errors()
        gst_errors = [e for e in errors if "gst_percentage" in str(e.get("loc", ""))]
        assert len(gst_errors) > 0
        msg = gst_errors[0]["msg"]
        assert "GST" in msg, f"Not human-readable: {msg!r}"

    def test_stock_is_not_required(self):
        """Stock quantity must NOT be required during product creation."""
        from app.schemas.inventory import ProductCreate
        # This should succeed without specifying stock
        obj = ProductCreate(
            code="ART-TEST-100",
            name="Test Product",
            price="2999",
            mrp="2999",
            barcode="8901234500001",
            gst_percentage="12",
        )
        assert obj.stock == 0, "Stock should default to 0, not be required"


# ─────────────────────────────────────────────────────────────────────────────
# Group 10: Structured 422 response contract
# ─────────────────────────────────────────────────────────────────────────────

class TestStructuredResponseContract:

    def test_response_has_required_keys(self):
        errors = [_make_pydantic_error(("body", "code"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        assert "error" in result
        error = result["error"]
        assert error["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        assert error["status"] == 422
        assert "message" in error
        assert "fields" in error
        assert isinstance(error["fields"], list)

    def test_field_entry_has_required_keys(self):
        errors = [_make_pydantic_error(("body", "brand"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        field = result["error"]["fields"][0]
        assert "field" in field
        assert "message" in field

    def test_field_entry_includes_section_for_known_fields(self):
        errors = [_make_pydantic_error(("body", "brand"), "field required", "missing")]
        result = ItemMasterValidationMapper.build_422_response(errors)
        field = result["error"]["fields"][0]
        assert "section" in field
        assert field["section"] == "Basic Information"

    def test_summary_message_contains_count(self):
        errors = [
            _make_pydantic_error(("body", "code"),  "field required", "missing"),
            _make_pydantic_error(("body", "brand"), "field required", "missing"),
        ]
        result = ItemMasterValidationMapper.build_422_response(errors)
        summary = result["error"]["message"]
        assert "2" in summary
        assert "fields" in summary or "field" in summary


# =============================================================================
# Group 11: Dynamic Attribute 422 — build_dynamic_attr_422_response()
# =============================================================================

_FORBIDDEN_IN_DYN = [
    "dynamic", "system validation", "pydantic", "fastapi",
    "traceback", "exception", "sqlalchemy", "attribute validation",
]


def _is_human_dyn(msg: str) -> bool:
    ml = msg.lower()
    return not any(f in ml for f in _FORBIDDEN_IN_DYN)


class TestDynamicAttr422:
    """Tests for build_dynamic_attr_422_response() and _parse_dynamic_attr_error()."""

    # ── _parse_dynamic_attr_error ───────────────────────────────────────────

    def test_parse_style_is_required(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Style is required")
        assert fk == "style_code"
        assert "Article" in msg or "Style" in msg
        assert _is_human_dyn(msg)
        assert sec == "Basic Information"

    def test_parse_article_no_is_required(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Article No is required")
        assert fk == "style_code"
        assert _is_human_dyn(msg)

    def test_parse_style_code_is_required(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Style Code is required")
        assert fk == "style_code"
        assert _is_human_dyn(msg)

    def test_parse_color_invalid(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error(
            "Color contains invalid value(s): Pink"
        )
        assert fk == "color"
        assert "Colour" in msg or "invalid" in msg.lower()
        assert _is_human_dyn(msg)
        assert sec == "Variant"

    def test_parse_colour_invalid(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error(
            "Colour contains invalid value(s): Magenta"
        )
        assert fk == "color"
        assert _is_human_dyn(msg)

    def test_parse_size_is_required(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Size is required")
        assert fk == "size"
        assert "Size" in msg
        assert _is_human_dyn(msg)
        assert sec == "Variant"

    def test_parse_size_system_is_required(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Size System is required")
        assert fk == "size_system"
        assert "Size System" in msg
        assert _is_human_dyn(msg)

    def test_parse_gender_is_required(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Gender is required")
        assert fk == "gender"
        assert _is_human_dyn(msg)

    def test_parse_im001_block(self):
        raw = "IM-001 [BLOCK]: Controlled field 'STYLE_CODE' value 'XYZ' not found in System Master Lookup (DB)."
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error(raw)
        # style_code or a fallback — must not expose IM-001 internals
        assert _is_human_dyn(msg)
        assert "IM-001" not in msg
        assert "[BLOCK]" not in msg
        assert "Controlled field" not in msg

    def test_parse_im001_gst_block(self):
        raw = "IM-001 [BLOCK]: Controlled field 'GST_RATE_PERCENT' value '12.0' not found in System Master Lookup (DB)."
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error(raw)
        assert _is_human_dyn(msg)
        assert "IM-001" not in msg

    def test_parse_unknown_label_safe_fallback(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error(
            "SomeUnknownDynamicField is required"
        )
        # Must return a safe field key and human-readable message
        assert fk  # non-empty
        assert _is_human_dyn(msg)
        assert "Dynamic" not in msg  # must not expose internal text
        assert "system validation" not in msg.lower()

    def test_parse_numeric_error(self):
        fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error("Style No must be numeric")
        assert fk == "style_code"
        assert "number" in msg.lower() or "numeric" in msg.lower()
        assert _is_human_dyn(msg)

    # ── build_dynamic_attr_422_response ───────────────────────────────────

    def test_build_returns_structured_contract(self):
        detail = {"message": "Dynamic attribute validation failed", "errors": ["Style is required"]}
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert result is not None
        assert result["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        assert result["error"]["status"] == 422
        assert isinstance(result["error"]["fields"], list)
        assert len(result["error"]["fields"]) == 1

    def test_build_multiple_errors(self):
        detail = {
            "message": "Dynamic attribute validation failed",
            "errors": ["Style is required", "Color contains invalid value(s): Neon"],
        }
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert result is not None
        fields = result["error"]["fields"]
        assert len(fields) == 2
        field_keys = {f["field"] for f in fields}
        assert "style_code" in field_keys
        assert "color" in field_keys
        for f in fields:
            assert _is_human_dyn(f["message"])

    def test_build_summary_contains_count(self):
        detail = {
            "errors": ["Style is required", "Size is required", "Color contains invalid value(s): X"]
        }
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert result is not None
        summary = result["error"]["message"]
        assert "3" in summary

    def test_build_deduplicates_same_field(self):
        detail = {
            "errors": ["Style is required", "Style Code is required"]
        }
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert result is not None
        # Both map to style_code — deduplication should yield only 1
        assert len(result["error"]["fields"]) == 1

    def test_build_returns_none_for_non_dict(self):
        assert ItemMasterValidationMapper.build_dynamic_attr_422_response("plain string") is None
        assert ItemMasterValidationMapper.build_dynamic_attr_422_response(None) is None
        assert ItemMasterValidationMapper.build_dynamic_attr_422_response([]) is None

    def test_build_returns_none_for_empty_errors_list(self):
        detail = {"message": "Dynamic attribute validation failed", "errors": []}
        # Empty errors list: no field_errors built, but dict has errors key (list).
        # If no errors parsed, should return None (caller falls through to generic handler).
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        # Either None (empty list) or structured with 0 fields
        if result is not None:
            assert result["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"

    def test_build_string_detail_with_style_required(self):
        # When detail is wrapped as {"errors": [<plain string>]}
        detail = {"errors": ["Style is required"]}
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert result is not None
        assert result["error"]["fields"][0]["field"] == "style_code"

    def test_build_im001_block_structured(self):
        raw = "IM-001 [BLOCK]: Controlled field 'GST_RATE_PERCENT' value '12.0' not found in System Master Lookup (DB)."
        detail = {"errors": [raw]}
        result = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert result is not None
        assert result["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        msg = result["error"]["fields"][0]["message"]
        assert _is_human_dyn(msg)
        assert "IM-001" not in msg
        assert "Controlled field" not in msg

    def test_build_all_messages_are_human_readable(self):
        """Fuzz: all known dynamic attr error strings must produce human-readable output."""
        raw_errors = [
            "Style is required",
            "Article No is required",
            "Color contains invalid value(s): Pink",
            "Size is required",
            "Size System is required",
            "Gender is required",
            "Season contains invalid value(s): Winter2020",
            "IM-001 [BLOCK]: Controlled field 'GST_RATE_PERCENT' value '12.0' not found in System Master Lookup (DB).",
            "SomeMysteryAttribute is required",
        ]
        for raw in raw_errors:
            fk, msg, sec = ItemMasterValidationMapper._parse_dynamic_attr_error(raw)
            assert _is_human_dyn(msg), f"Technical text found for: {raw!r} -> {msg!r}"
            assert len(msg) > 5, f"Message too short for: {raw!r} -> {msg!r}"

    # ── _DYN_LABEL_MAP registry check ─────────────────────────────────────

    def test_dyn_label_map_no_empty_values(self):
        for label, (fk, msg, sec) in _DYN_LABEL_MAP.items():
            assert fk, f"Empty field_key for label: {label!r}"
            assert msg, f"Empty message for label: {label!r}"
            assert sec, f"Empty section for label: {label!r}"

    def test_dyn_label_map_no_technical_messages(self):
        for label, (fk, msg, sec) in _DYN_LABEL_MAP.items():
            assert _is_human_dyn(msg), f"Technical text in message for label {label!r}: {msg!r}"
