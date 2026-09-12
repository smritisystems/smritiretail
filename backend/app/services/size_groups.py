from __future__ import annotations

from typing import Any


def normalize_size_group_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize registry-driven size group payloads into the canonical runtime shape."""
    data = payload.get("data") or {}

    values = data.get("values") or payload.get("values") or []
    if isinstance(values, str):
        values = [entry.strip() for entry in values.split(",") if entry.strip()]
    elif not isinstance(values, list):
        values = []

    category = str(data.get("category") or payload.get("category") or "APPAREL").strip().upper()
    if not category:
        category = "APPAREL"

    dimension = str(data.get("dimension") or payload.get("dimension") or "size").strip().lower() or "size"

    return {
        "code": str(payload.get("code") or "").strip(),
        "name": str(payload.get("name") or "").strip(),
        "category": category,
        "dimension": dimension,
        "values": [str(value).strip() for value in values if str(value).strip()],
        "description": str(data.get("description") or payload.get("description") or "").strip(),
        "active": payload.get("active", True),
    }
