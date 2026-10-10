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

from typing import List
from ..models import LabelTemplate, PrintItemPayload, ElementType
from ..dpi import DpiEngine
from .zpl_renderer import resolve_field_value


def render_dpl(template: LabelTemplate, items: List[PrintItemPayload], dpi: int = 203) -> str:
    """
    Compiles protocol-agnostic LabelTemplate + Item batch into Honeywell / Datamax DPL byte stream.
    """
    engine = DpiEngine(dpi=dpi)
    script_lines = ["\x02L", "D11"]

    for item in items:
        qty = max(1, item.qty)
        for _ in range(qty):
            for el in template.elements:
                x = engine.mm_to_dots_x(el.x_mm)
                y = engine.mm_to_dots_y(el.y_mm)
                
                # Format row position (4 digits) & col position (4 digits)
                r_str = f"{min(9999, y):04d}"
                c_str = f"{min(9999, x):04d}"

                if el.type == ElementType.TEXT:
                    val = el.static_text or resolve_field_value(el.field_binding or "", item)
                    # 1911: Font 9, Subfont 1, standard text
                    script_lines.append(f"1911000{r_str}{c_str}{val}")

                elif el.type == ElementType.BARCODE_128:
                    val = resolve_field_value(el.field_binding or "item.barcode", item, default=item.barcode or item.code or "890100000001")
                    # 1e42: Code 128 barcode
                    script_lines.append(f"1e42020{r_str}{c_str}{val}")

            script_lines.append("E")

    return "\n".join(script_lines) + "\n"
