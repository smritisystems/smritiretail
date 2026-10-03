import re
from typing import Dict, List


BARCODE_TYPE_POLICY: List[Dict[str, object]] = [
    {"code": "EAN13", "label": "EAN-13", "business_use": "Retail products / GTIN", "default_purpose": "RETAIL", "default_standard": "NONE", "primary_identity": True, "requires_numeric": True, "lengths": [13]},
    {"code": "EAN8", "label": "EAN-8", "business_use": "Small retail packages", "default_purpose": "RETAIL", "default_standard": "NONE", "primary_identity": True, "requires_numeric": True, "lengths": [8]},
    {"code": "UPCA", "label": "UPC-A", "business_use": "North American retail", "default_purpose": "RETAIL", "default_standard": "NONE", "primary_identity": True, "requires_numeric": True, "lengths": [12]},
    {"code": "UPCE", "label": "UPC-E", "business_use": "Compact UPC", "default_purpose": "RETAIL", "default_standard": "NONE", "primary_identity": True, "requires_numeric": True, "lengths": [6, 8]},
    {"code": "ITF14", "label": "ITF-14", "business_use": "Cartons / cases / logistics", "default_purpose": "CASE", "default_standard": "NONE", "primary_identity": False, "requires_numeric": True, "lengths": [14]},
    {"code": "GS1_128", "label": "GS1-128", "business_use": "Logistics + structured GS1 data", "default_purpose": "LOGISTICS", "default_standard": "GS1", "primary_identity": False, "requires_numeric": False},
    {"code": "GS1_DATAMATRIX", "label": "GS1 DataMatrix", "business_use": "Healthcare / serialized products / GS1 data", "default_purpose": "SERIALIZED", "default_standard": "GS1", "primary_identity": False, "requires_numeric": False},
    {"code": "CODE128", "label": "Code 128", "business_use": "Internal SKU / inventory / logistics", "default_purpose": "INTERNAL", "default_standard": "CUSTOM", "primary_identity": False, "requires_numeric": False},
    {"code": "CODE39", "label": "Code 39", "business_use": "Legacy industrial/internal identification", "default_purpose": "INTERNAL", "default_standard": "CUSTOM", "primary_identity": False, "requires_numeric": False},
    {"code": "CODE93", "label": "Code 93", "business_use": "Internal/logistics", "default_purpose": "INTERNAL", "default_standard": "CUSTOM", "primary_identity": False, "requires_numeric": False},
    {"code": "QR", "label": "QR Code", "business_use": "2D links, product information, internal workflows", "default_purpose": "INTERNAL", "default_standard": "CUSTOM", "primary_identity": False, "requires_numeric": False},
    {"code": "DATAMATRIX", "label": "DataMatrix", "business_use": "Compact 2D identification", "default_purpose": "ASSET", "default_standard": "CUSTOM", "primary_identity": False, "requires_numeric": False},
    {"code": "PDF417", "label": "PDF417", "business_use": "Documents / logistics / identification", "default_purpose": "DOCUMENT", "default_standard": "CUSTOM", "primary_identity": False, "requires_numeric": False},
]

BARCODE_TYPES = {entry["code"] for entry in BARCODE_TYPE_POLICY}
BARCODE_PURPOSES = {"RETAIL", "INTERNAL", "LOGISTICS", "SERIALIZED", "LOT", "CASE", "ASSET", "DOCUMENT"}
ENCODING_STANDARDS = {"NONE", "GS1", "CUSTOM"}


def detect_barcode_type(value: str) -> Dict[str, object]:
    """Return conservative hints; detection never assigns ownership or replaces metadata."""
    clean_value = value.strip()
    if not clean_value:
        return {"detected": False, "confidence": "NONE", "candidates": [], "reason": "Barcode value is empty"}
    if "(01)" in clean_value or clean_value.startswith("01") and "(" in clean_value:
        return {"detected": True, "confidence": "HIGH", "candidates": ["GS1_128", "GS1_DATAMATRIX"], "encoding_standard": "GS1", "reason": "GS1 application identifier detected"}
    if clean_value.isdigit():
        candidates = {13: ["EAN13"], 8: ["EAN8"], 12: ["UPCA"], 14: ["ITF14"]}.get(len(clean_value), [])
        if len(clean_value) in (6, 8):
            candidates = list(dict.fromkeys(candidates + ["UPCE"]))
        if candidates:
            return {"detected": True, "confidence": "MEDIUM", "candidates": candidates, "reason": "Numeric length matches a retail or logistics symbology"}
    if all(32 <= ord(char) <= 126 for char in clean_value):
        return {"detected": True, "confidence": "LOW", "candidates": ["CODE128", "CODE39", "CODE93", "QR", "DATAMATRIX", "PDF417"], "reason": "Printable payload; physical symbology requires scanner metadata"}
    return {"detected": False, "confidence": "NONE", "candidates": [], "reason": "Payload format is not recognized"}


def validate_barcode_value(barcode_type: str, value: str, purpose: str = "RETAIL", standard: str = "NONE") -> str:
    normalized_type = barcode_type.strip().upper()
    if normalized_type not in BARCODE_TYPES:
        raise ValueError(f"Unsupported barcode type '{barcode_type}'")
    clean_value = value.strip()
    definition = next(entry for entry in BARCODE_TYPE_POLICY if entry["code"] == normalized_type)
    if purpose.upper() not in BARCODE_PURPOSES:
        raise ValueError(f"Unsupported barcode purpose '{purpose}'")
    if standard.upper() not in ENCODING_STANDARDS:
        raise ValueError(f"Unsupported encoding standard '{standard}'")
    if not clean_value:
        raise ValueError("Barcode value cannot be empty")
    if definition["requires_numeric"]:
        lengths = definition.get("lengths", [])
        if not clean_value.isdigit() or len(clean_value) not in lengths:
            allowed = ", ".join(str(length) for length in lengths)
            raise ValueError(f"{normalized_type} must contain only digits and be {allowed} characters")
    elif normalized_type in {"CODE128", "CODE39", "CODE93"} and not re.fullmatch(r"[\x20-\x7E]+", clean_value):
        raise ValueError(f"{normalized_type} contains unsupported characters")
    return normalized_type