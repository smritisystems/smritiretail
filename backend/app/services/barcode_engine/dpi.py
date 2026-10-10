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

from typing import Tuple


class DpiEngine:
    """
    Continuous Mathematical DPI Scaling Engine.
    Implements dots_per_mm = dpi / 25.4.
    Eliminates hardcoded coordinate approximations across 203, 300, and 600 DPI heads.
    """

    def __init__(self, dpi: int = 203):
        self.dpi = max(100, int(dpi))
        self.dots_per_mm = float(self.dpi) / 25.4

    def mm_to_dots_x(self, mm: float) -> int:
        return round(float(mm) * self.dots_per_mm)

    def mm_to_dots_y(self, mm: float) -> int:
        return round(float(mm) * self.dots_per_mm)

    def mm_to_dots_w(self, mm: float) -> int:
        return max(1, round(float(mm) * self.dots_per_mm))

    def mm_to_dots_h(self, mm: float) -> int:
        return max(1, round(float(mm) * self.dots_per_mm))

    def pt_to_dots(self, pt: float) -> int:
        """Converts typographic points (1/72 inch) to target printer dots."""
        return max(8, round((float(pt) * self.dpi) / 72.0))

    def zpl_font_size(self, pt: float) -> Tuple[int, int]:
        """Calculates ZPL height and width dots for standard scalable smooth fonts."""
        h = self.pt_to_dots(pt)
        # ZPL standard aspect ratio is approx 0.85 - 1.0 width-to-height
        w = max(6, round(h * 0.9))
        return h, w
