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

from typing import List, Dict, Any
from ..models import LabelTemplate, PrintItemPayload, ElementType
from ..dpi import DpiEngine


def resolve_field_value(binding: str, item: PrintItemPayload, default: str = "") -> str:
    if not binding:
        return default
    
    # Strip prefix like "item."
    key = binding.replace("item.", "").strip()
    
    if hasattr(item, key):
        val = getattr(item, key)
        if val is not None:
            if isinstance(val, float):
                return str(int(val)) if val.is_integer() else f"{val:.2f}"
            return str(val)
            
    # Check attributes dict
    if item.attributes and key in item.attributes:
        val = item.attributes[key]
        if val is not None:
            return str(val)
            
    return default


def render_zpl(template: LabelTemplate, items: List[PrintItemPayload], dpi: int = 203) -> str:
    """
    Compiles protocol-agnostic LabelTemplate + Item batch into an authoritative Zebra ZPL byte stream.
    Applies continuous mathematical DPI scaling to ensure sub-millimeter precision.
    """
    engine = DpiEngine(dpi=dpi)
    pw_dots = engine.mm_to_dots_w(template.width_mm)
    ll_dots = engine.mm_to_dots_h(template.height_mm)
    pitch_str = f"{template.height_mm:.1f} mm"

    blocks = []
    
    for item in items:
        qty = max(1, item.qty)
        for _ in range(qty):
            lines = [
                f"<xpml><page quantity='0' pitch='{pitch_str}'></xpml>^XA",
                "^SZ2^JMA",
                "^MCY^PMN",
                f"^PW{pw_dots}",
                "^JZY",
                "^LH0,0^LRN",
                "^CI0",
            ]

            for el in template.elements:
                x = engine.mm_to_dots_x(el.x_mm)
                y = engine.mm_to_dots_y(el.y_mm)
                w = engine.mm_to_dots_w(el.width_mm or 10.0)
                h = engine.mm_to_dots_h(el.height_mm or 5.0)
                stroke = max(1, engine.mm_to_dots_w(el.stroke_width_mm or 0.3))

                if el.type == ElementType.TEXT:
                    val = el.static_text or resolve_field_value(el.field_binding or "", item)
                    f_h, f_w = engine.zpl_font_size(el.font_size_pt or 10.0)
                    rot = "N"
                    if el.rotation_deg == 90:
                        rot = "R"
                    elif el.rotation_deg == 180:
                        rot = "I"
                    elif el.rotation_deg == 270:
                        rot = "B"

                    lines.append(f"^FT{x},{y}")
                    lines.append(f"^A0{rot},{f_h},{f_w}^FD{val}^FS")

                elif el.type == ElementType.INVERTED_BOX:
                    # Black filled rectangle
                    lines.append(f"^FO{x},{y}")
                    lines.append(f"^GB{w},{h},{h}^FS")
                    
                    # Reverse white text placed inside
                    val = el.static_text or resolve_field_value(el.text_binding or el.field_binding or "", item)
                    f_h, f_w = engine.zpl_font_size(el.font_size_pt or 16.0)
                    text_y = y + h - max(2, round(h * 0.18))
                    text_x = x + max(2, round(w * 0.08))
                    lines.append(f"^FT{text_x},{text_y}")
                    lines.append(f"^A0N,{f_h},{f_w}^FR^FD{val}^FS")

                elif el.type == ElementType.BOX:
                    lines.append(f"^FO{x},{y}")
                    lines.append(f"^GB{w},{h},{stroke}^FS")

                elif el.type == ElementType.LINE:
                    # In ZPL, a horizontal or vertical line is a ^GB with 0 for opposite dimension
                    is_vert = w <= stroke or (el.height_mm or 0) > (el.width_mm or 0)
                    if is_vert:
                        lines.append(f"^FO{x},{y}^GB0,{h},{stroke}^FS")
                    else:
                        lines.append(f"^FO{x},{y}^GB{w},0,{stroke}^FS")

                elif el.type == ElementType.BARCODE_128:
                    val = resolve_field_value(el.field_binding or "item.barcode", item, default=item.barcode or item.code or "890100000001")
                    module_w = 2 if dpi <= 203 else (3 if dpi <= 300 else 6)
                    lines.append(f"^FO{x},{y}")
                    lines.append(f"^BY{module_w}^BCN,{h},N,N^FD{val}^FS")
                    
                    if el.show_hri:
                        hri_y = y + h + engine.pt_to_dots(10)
                        lines.append(f"^FT{x + max(4, round(w * 0.1))},{hri_y}")
                        lines.append(f"^CI0^AAN,27,15^FD{val}^FS")

                elif el.type == ElementType.QR_CODE:
                    val = resolve_field_value(el.field_binding or "item.barcode", item, default=item.barcode or "")
                    mag = 3 if dpi <= 203 else 5
                    lines.append(f"^FO{x},{y}^BQN,2,{mag}^FDQA,{val}^FS")

            lines.append("^PQ1,0,1,Y")
            lines.append("^XZ")
            lines.append(f"<xpml></page></xpml>")
            blocks.append("\n".join(lines))

    final_stream = "\n".join(blocks) + "\n<xpml><end/></xpml>"
    return final_stream
