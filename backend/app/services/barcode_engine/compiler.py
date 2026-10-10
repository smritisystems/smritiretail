"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.49
Created      : 2026-10-10
Modified     : 2026-10-10
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import hashlib
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from .models import LabelTemplate, PrintItemPayload, ProtocolType
from .registry import template_registry
from .renderers.zpl_renderer import render_zpl
from .renderers.dpl_renderer import render_dpl
from .renderers.svg_renderer import render_svg


class CompilationResult(BaseModel):
    template_id: str
    template_name: str
    protocol: ProtocolType
    dpi: int
    total_items: int
    total_labels: int
    payload_stream: str
    payload_hash: str
    svg_preview: Optional[str] = None


class BarcodeCompiler:
    """
    Central Barcode Compilation Service.
    Resolves templates, performs continuous DPI transformations, and compiles multi-protocol streams.
    """

    @classmethod
    def compile(
        cls,
        template_id: str,
        items: List[PrintItemPayload],
        protocol: ProtocolType = ProtocolType.ZPL,
        dpi: int = 203,
        custom_template: Optional[LabelTemplate] = None
    ) -> CompilationResult:
        template = custom_template or template_registry.get(template_id)
        if not template:
            # Fallback to default retail 50x25
            template = template_registry.get("retail-50x25")
            if not template:
                raise ValueError(f"Template '{template_id}' not found in registry.")

        if not items:
            raise ValueError("Print job must contain at least 1 item payload.")

        total_items = len(items)
        total_labels = sum(max(1, item.qty) for item in items)

        # Multi-Protocol Selection
        if protocol == ProtocolType.ZPL:
            payload_stream = render_zpl(template, items, dpi=dpi)
        elif protocol == ProtocolType.DPL:
            payload_stream = render_dpl(template, items, dpi=dpi)
        elif protocol == ProtocolType.SVG:
            payload_stream = render_svg(template, items[0] if items else None)
        else:
            # Default to ZPL
            payload_stream = render_zpl(template, items, dpi=dpi)

        payload_hash = hashlib.sha256(payload_stream.encode("utf-8")).hexdigest()
        sample_svg = render_svg(template, items[0] if items else None)

        return CompilationResult(
            template_id=template.id,
            template_name=template.name,
            protocol=protocol,
            dpi=dpi,
            total_items=total_items,
            total_labels=total_labels,
            payload_stream=payload_stream,
            payload_hash=payload_hash,
            svg_preview=sample_svg
        )
