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

from typing import Dict, List, Optional
from .models import LabelTemplate, LabelElement, ElementType


def build_footwear_100x50_7_template() -> LabelTemplate:
    """
    Authoritative 3-part Footwear Box Tag with Dual Counter Stubs (100mm x 50.7mm).
    Exact metric coordinates matching physical die-cut rolls.
    """
    elements = [
        # Perforation dividers
        LabelElement(id="div_vert", type=ElementType.LINE, x_mm=31.2, y_mm=0.0, width_mm=0.0, height_mm=50.7, stroke_width_mm=0.3, stroke_color="#9ca3af"),
        LabelElement(id="div_horiz_stub", type=ElementType.LINE, x_mm=0.0, y_mm=25.3, width_mm=31.2, height_mm=0.0, stroke_width_mm=0.3, stroke_color="#9ca3af"),

        # STUB 1 (Upper Counter Stub: 0 to 25.3 mm)
        LabelElement(id="s1_brand", type=ElementType.TEXT, x_mm=2.1, y_mm=18.2, font_size_pt=8, font_weight="bold", rotation_deg=270, field_binding="item.brand"),
        LabelElement(id="s1_art_no", type=ElementType.TEXT, x_mm=4.6, y_mm=4.2, font_size_pt=10, font_weight="bold", field_binding="item.style"),
        LabelElement(id="s1_size_box", type=ElementType.INVERTED_BOX, x_mm=4.6, y_mm=5.9, width_mm=7.0, height_mm=6.7, font_size_pt=18, text_binding="item.size"),
        LabelElement(id="s1_color", type=ElementType.TEXT, x_mm=14.5, y_mm=7.9, font_size_pt=10, font_weight="bold", field_binding="item.color"),
        LabelElement(id="s1_mrp", type=ElementType.TEXT, x_mm=14.5, y_mm=10.5, font_size_pt=9, font_weight="bold", field_binding="item.mrp"),
        LabelElement(id="s1_tax", type=ElementType.TEXT, x_mm=14.5, y_mm=12.6, font_size_pt=6, static_text="(Incl of all taxes)"),
        LabelElement(id="s1_barcode", type=ElementType.BARCODE_128, x_mm=4.2, y_mm=14.0, width_mm=22.5, height_mm=3.2, show_hri=True, field_binding="item.barcode"),

        # STUB 2 (Lower Audit Stub: 25.3 to 50.7 mm)
        LabelElement(id="s2_brand", type=ElementType.TEXT, x_mm=2.0, y_mm=46.5, font_size_pt=8, font_weight="bold", rotation_deg=270, field_binding="item.brand"),
        LabelElement(id="s2_art_no", type=ElementType.TEXT, x_mm=4.1, y_mm=32.5, font_size_pt=10, font_weight="bold", field_binding="item.style"),
        LabelElement(id="s2_size_box", type=ElementType.INVERTED_BOX, x_mm=4.1, y_mm=34.2, width_mm=7.0, height_mm=6.7, font_size_pt=18, text_binding="item.size"),
        LabelElement(id="s2_color", type=ElementType.TEXT, x_mm=14.5, y_mm=36.1, font_size_pt=10, font_weight="bold", field_binding="item.color"),
        LabelElement(id="s2_mrp", type=ElementType.TEXT, x_mm=14.5, y_mm=38.7, font_size_pt=9, font_weight="bold", field_binding="item.mrp"),
        LabelElement(id="s2_tax", type=ElementType.TEXT, x_mm=14.5, y_mm=40.8, font_size_pt=6, static_text="(Incl of all taxes)"),
        LabelElement(id="s2_barcode", type=ElementType.BARCODE_128, x_mm=4.1, y_mm=42.2, width_mm=22.5, height_mm=3.2, show_hri=True, field_binding="item.barcode"),

        # MAIN SHOE BOX LABEL (Right Section: 31.2 to 100 mm)
        LabelElement(id="m_header_box", type=ElementType.BOX, x_mm=41.5, y_mm=1.6, width_mm=45.9, height_mm=14.6, stroke_width_mm=0.4),
        LabelElement(id="m_header_div", type=ElementType.LINE, x_mm=41.7, y_mm=7.1, width_mm=42.1, height_mm=0.0, stroke_width_mm=0.4),
        LabelElement(id="m_lbl_art", type=ElementType.TEXT, x_mm=42.5, y_mm=5.1, font_size_pt=8, font_weight="bold", static_text="Art.No."),
        LabelElement(id="m_art_box", type=ElementType.INVERTED_BOX, x_mm=52.0, y_mm=1.9, width_mm=35.5, height_mm=5.0, font_size_pt=14, text_binding="item.style"),
        
        LabelElement(id="m_lbl_col", type=ElementType.TEXT, x_mm=42.5, y_mm=12.9, font_size_pt=8, font_weight="bold", static_text="Color:"),
        LabelElement(id="m_color", type=ElementType.TEXT, x_mm=50.6, y_mm=12.9, font_size_pt=12, font_weight="bold", field_binding="item.color"),
        LabelElement(id="m_size_box", type=ElementType.INVERTED_BOX, x_mm=78.4, y_mm=7.7, width_mm=8.7, height_mm=8.3, font_size_pt=20, text_binding="item.size"),

        # Pricing & Legal Notice
        LabelElement(id="m_lbl_mrp", type=ElementType.TEXT, x_mm=44.4, y_mm=21.2, font_size_pt=10, font_weight="bold", static_text="MRP:"),
        LabelElement(id="m_price", type=ElementType.TEXT, x_mm=51.2, y_mm=21.9, font_size_pt=16, font_weight="900", field_binding="item.mrp"),
        LabelElement(id="m_taxes", type=ElementType.TEXT, x_mm=61.2, y_mm=21.5, font_size_pt=7, static_text="|(Incl of all taxes)"),
        LabelElement(id="m_mfg", type=ElementType.TEXT, x_mm=44.4, y_mm=24.9, font_size_pt=7, static_text="MFG.Dt.:10/26"),
        LabelElement(id="m_contents", type=ElementType.TEXT, x_mm=44.4, y_mm=26.9, font_size_pt=6, static_text="NET CONTENTS:1 Pair Footwear"),

        # Legal Metrology / Marketer block
        LabelElement(id="m_div_legal", type=ElementType.LINE, x_mm=40.5, y_mm=29.5, width_mm=50.9, height_mm=0.0, stroke_width_mm=0.4),
        LabelElement(id="m_mktd", type=ElementType.TEXT, x_mm=44.4, y_mm=32.6, font_size_pt=8, font_weight="bold", field_binding="item.company_name"),
        LabelElement(id="m_addr", type=ElementType.TEXT, x_mm=44.4, y_mm=34.8, font_size_pt=6, field_binding="item.company_address"),
        LabelElement(id="m_email", type=ElementType.TEXT, x_mm=44.4, y_mm=36.7, font_size_pt=6, field_binding="item.company_email"),

        # Scannable Barcode Symbol
        LabelElement(id="m_barcode", type=ElementType.BARCODE_128, x_mm=43.2, y_mm=38.1, width_mm=45.0, height_mm=8.2, show_hri=True, field_binding="item.barcode"),

        # Right Vertical Brand Margin
        LabelElement(id="m_div_brand", type=ElementType.LINE, x_mm=91.4, y_mm=0.0, width_mm=0.0, height_mm=50.7, stroke_width_mm=0.4),
        LabelElement(id="m_brand_rot", type=ElementType.TEXT, x_mm=96.5, y_mm=44.6, font_size_pt=14, font_weight="bold", rotation_deg=270, field_binding="item.brand"),
    ]

    return LabelTemplate(
        id="tattly-threads-footwear-100x50.7",
        name="Tattly Threads Footwear — 100x50.7mm",
        width_mm=100.0,
        height_mm=50.7,
        default_dpi=203,
        description="Standard 3-Part Footwear Box Tag with Upper Counter Stub and Lower Audit Stub",
        elements=elements
    )


def build_retail_50x25_template() -> LabelTemplate:
    """Standard 50mm x 25mm Retail Barcode Sticker."""
    elements = [
        LabelElement(id="r_brand", type=ElementType.TEXT, x_mm=3.0, y_mm=4.0, font_size_pt=8, font_weight="bold", field_binding="item.brand"),
        LabelElement(id="r_price", type=ElementType.TEXT, x_mm=35.0, y_mm=4.0, font_size_pt=9, font_weight="bold", field_binding="item.mrp"),
        LabelElement(id="r_name", type=ElementType.TEXT, x_mm=3.0, y_mm=7.5, font_size_pt=7, field_binding="item.name"),
        LabelElement(id="r_barcode", type=ElementType.BARCODE_128, x_mm=3.0, y_mm=9.5, width_mm=44.0, height_mm=9.0, show_hri=True, field_binding="item.barcode"),
        LabelElement(id="r_attr", type=ElementType.TEXT, x_mm=3.0, y_mm=23.0, font_size_pt=6, field_binding="item.color"),
        LabelElement(id="r_size", type=ElementType.TEXT, x_mm=35.0, y_mm=23.0, font_size_pt=6, field_binding="item.size"),
    ]
    return LabelTemplate(
        id="retail-50x25",
        name="Retail Sticker — 50x25mm",
        width_mm=50.0,
        height_mm=25.0,
        default_dpi=203,
        description="Standard 50mm x 25mm 1-up retail roll sticker",
        elements=elements
    )


class TemplateRegistry:
    """Singleton Registry managing protocol-agnostic label templates."""

    def __init__(self):
        self._templates: Dict[str, LabelTemplate] = {}
        self.register(build_footwear_100x50_7_template())
        self.register(build_retail_50x25_template())

    def register(self, template: LabelTemplate) -> None:
        self._templates[template.id] = template
        # Support aliases
        if template.id == "tattly-threads-footwear-100x50.7":
            self._templates["lay-footwear-100x50-3stub"] = template
            self._templates["tattly-footwear-100x50.7"] = template

    def get(self, template_id: str) -> Optional[LabelTemplate]:
        return self._templates.get(template_id)

    def list_all(self) -> List[LabelTemplate]:
        # Return unique by id
        seen = set()
        result = []
        for t in self._templates.values():
            if t.id not in seen:
                seen.add(t.id)
                result.append(t)
        return result


# Global singleton instance
template_registry = TemplateRegistry()
