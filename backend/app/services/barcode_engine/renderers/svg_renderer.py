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

import html
from typing import Optional
from ..models import LabelTemplate, PrintItemPayload, ElementType
from .zpl_renderer import resolve_field_value


def render_svg(template: LabelTemplate, item: Optional[PrintItemPayload] = None, preview_scale: float = 1.0) -> str:
    """
    Renders protocol-agnostic LabelTemplate into an SVG string for WYSIWYG client preview.
    Uses metric coordinate system (viewBox in mm or scaled 8px/mm).
    """
    if item is None:
        item = PrintItemPayload(
            code="000006",
            barcode="890100000006",
            name="Tattly Threads Footwear",
            brand="TATTLY THREADS",
            style="CH-30-K",
            color="BLACK",
            size="37",
            mrp=1199,
            price=1199,
            qty=1
        )

    w_mm = template.width_mm
    h_mm = template.height_mm
    view_w = round(w_mm * 8.0)
    view_h = round(h_mm * 8.0)

    svg_elements = [
        f'<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w_mm}mm" height="{h_mm}mm" viewBox="0 0 {view_w} {view_h}">',
        f'  <rect width="{view_w}" height="{view_h}" fill="#ffffff" stroke="#d1d5db" stroke-width="1"/>',
    ]

    for el in template.elements:
        # Convert mm to 8px/mm viewBox units
        x = round(el.x_mm * 8.0)
        y = round(el.y_mm * 8.0)
        w = round((el.width_mm or 10.0) * 8.0)
        h = round((el.height_mm or 5.0) * 8.0)
        stroke_w = max(1, round((el.stroke_width_mm or 0.3) * 8.0))

        if el.type == ElementType.TEXT:
            raw_val = el.static_text or resolve_field_value(el.field_binding or "", item)
            val = html.escape(str(raw_val))
            f_size = round((el.font_size_pt or 10.0) * 1.33)
            f_weight = el.font_weight or "normal"
            rot = el.rotation_deg or 0
            
            transform_attr = f' transform="rotate({rot} {x},{y})"' if rot != 0 else ""
            svg_elements.append(
                f'  <text x="{x}" y="{y}" font-family="{el.font_family or "Arial"}, sans-serif" font-size="{f_size}" font-weight="{f_weight}" fill="{el.fill_color or "#000000"}"{transform_attr}>{val}</text>'
            )

        elif el.type == ElementType.INVERTED_BOX:
            raw_val = el.static_text or resolve_field_value(el.text_binding or el.field_binding or "", item)
            val = html.escape(str(raw_val))
            f_size = round((el.font_size_pt or 16.0) * 1.33)
            svg_elements.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#000000" rx="3"/>')
            svg_elements.append(
                f'  <text x="{x + w // 2}" y="{y + h - 6}" font-family="Arial, sans-serif" font-size="{f_size}" font-weight="900" fill="#ffffff" text-anchor="middle">{val}</text>'
            )

        elif el.type == ElementType.BOX:
            svg_elements.append(
                f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{el.stroke_color or "#000000"}" stroke-width="{stroke_w}"/>'
            )

        elif el.type == ElementType.LINE:
            # Check orientation
            if (el.height_mm or 0) > (el.width_mm or 0):
                svg_elements.append(f'  <line x1="{x}" y1="{y}" x2="{x}" y2="{y + h}" stroke="{el.stroke_color or "#000000"}" stroke-width="{stroke_w}"/>')
            else:
                svg_elements.append(f'  <line x1="{x}" y1="{y}" x2="{x + w}" y2="{y}" stroke="{el.stroke_color or "#000000"}" stroke-width="{stroke_w}"/>')

        elif el.type == ElementType.BARCODE_128:
            raw_val = resolve_field_value(el.field_binding or "item.barcode", item, default=item.barcode or item.code or "890100000001")
            val = html.escape(str(raw_val))
            svg_elements.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#111827"/>')
            if el.show_hri:
                svg_elements.append(
                    f'  <text x="{x + w // 2}" y="{y + h + 14}" font-family="monospace" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">{val}</text>'
                )

    svg_elements.append("</svg>")
    return "\n".join(svg_elements)
