# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

PRN Script Generator Engine
============================
Template-driven raw ZPL/TSPL PRN content generator for thermal barcode label printers.
Handles central token substitution via token_registry.build_token_dict() and built-in fallback scripts.
"""

import re
from typing import List, Dict, Any, Union, Optional
from .token_registry import build_token_dict


def safe_template_substitute(template: str, token_dict: Dict[str, str]) -> str:
    """
    Replaces `{token}` placeholders in raw ZPL/TSPL templates with token_dict values.
    Leaves any other literal `{` or `}` untouched instead of crashing.
    """
    if not template:
        return ""

    if not token_dict:
        return template

    pattern = r"\{(" + "|".join(re.escape(k) for k in token_dict.keys()) + r")\}"

    def _replace(match):
        key = match.group(1)
        return str(token_dict.get(key, match.group(0)))

    return re.sub(pattern, _replace, template)


# ---------------------------------------------------------------------------
# BUILT-IN FALLBACK TEMPLATES (ZPL & TSPL)
# ---------------------------------------------------------------------------

FALLBACK_TEMPLATES = {
    "ZPL": {
        "50x25": """^XA
^PW400
^LL200
^FO10,10^A0N,20,20^FD{brand}^FS
^FO10,35^A0N,18,18^FD{item_name}^FS
^FO10,55^A0N,16,16^FDStyle: {style}^FS
^FO10,72^A0N,16,16^FDSize: {size}  Color: {color}^FS
^FO10,95^BY2,3,40^BCN,40,Y,N,N^FD{barcode}^FS
^FO10,150^A0N,20,20^FDMRP: Rs.{mrp}.00^FS
^FO10,175^A0N,14,14^FDPkd: {pkd_date}  {company}^FS
^XZ""",
        "38x25": """^XA
^PW304
^LL200
^FO10,10^A0N,18,18^FD{brand}^FS
^FO10,30^A0N,16,16^FD{item_name}^FS
^FO10,48^A0N,14,14^FDSz:{size} Col:{color}^FS
^FO10,68^BY2,2,35^BCN,35,Y,N,N^FD{barcode}^FS
^FO10,118^A0N,18,18^FDMRP: Rs.{mrp}^FS
^XZ""",
        "100x50": """^XA
^PW800
^LL400
^FO20,20^A0N,32,32^FD{brand}^FS
^FO20,60^A0N,26,26^FDItem: {item_name}^FS
^FO20,95^A0N,22,22^FDStyle: {style}  |  Art: {article_no}^FS
^FO20,125^A0N,22,22^FDSize: {size}  |  Color: {color}  |  Mat: {material}^FS
^FO20,160^BY3,3,70^BCN,70,Y,N,N^FD{barcode}^FS
^FO20,250^A0N,36,36^FDMRP: Rs.{mrp}.00 (Incl. of all taxes)^FS
^FO20,295^A0N,20,20^FDPacked Date: {pkd_date}  |  HSN: {hsn}^FS
^FO20,325^A0N,18,18^FDMfd & Mkt by: {company}^FS
^XZ"""
    },
    "TSPL": {
        "50x25": """SIZE 50 mm, 25 mm
GAP 2 mm, 0 mm
DIRECTION 1
CLS
TEXT 10,10,"2",0,1,1,"{brand}"
TEXT 10,30,"1",0,1,1,"{item_name}"
TEXT 10,48,"1",0,1,1,"Style: {style} Sz:{size}"
BARCODE 10,70,"128",40,1,0,2,2,"{barcode}"
TEXT 10,120,"2",0,1,1,"MRP: Rs.{mrp}.00"
PRINT 1,1
""",
        "38x25": """SIZE 38 mm, 25 mm
GAP 2 mm, 0 mm
DIRECTION 1
CLS
TEXT 10,10,"2",0,1,1,"{brand}"
TEXT 10,30,"1",0,1,1,"{item_name}"
BARCODE 10,50,"128",35,1,0,2,2,"{barcode}"
TEXT 10,95,"2",0,1,1,"MRP: Rs.{mrp}"
PRINT 1,1
"""
    }
}


def generate_prn_script(
    items: List[Dict[str, Any]],
    raw_template: Optional[str] = None,
    protocol: str = "ZPL",
    label_size: str = "50x25",
    company_name: str = "SMRITI RETAIL"
) -> Dict[str, Any]:
    """
    Generates combined raw PRN script (ZPL/TSPL) for a batch of items.

    Args:
        items: List of item data dicts.
        raw_template: Custom ZPL/TSPL raw template string (optional).
        protocol: Printer command language ("ZPL", "TSPL", "EPL", "ESC/POS").
        label_size: Label dimensions profile ("50x25", "38x25", "100x50").
        company_name: Company legal name for footer token.

    Returns:
        dict: {
            "prn": str,
            "total_labels": int,
            "items_processed": int,
            "protocol": str
        }
    """
    if not items:
        return {
            "prn": "",
            "total_labels": 0,
            "items_processed": 0,
            "protocol": protocol
        }

    lang = (protocol or "ZPL").upper()
    size_key = (label_size or "50x25").lower()

    # Determine template to use
    template_to_use = raw_template
    if not template_to_use:
        lang_templates = FALLBACK_TEMPLATES.get(lang) or FALLBACK_TEMPLATES["ZPL"]
        template_to_use = lang_templates.get(size_key) or lang_templates.get("50x25") or FALLBACK_TEMPLATES["ZPL"]["50x25"]

    prn_chunks = []
    total_labels = 0

    for item in items:
        qty = int(item.get("print_qty") or item.get("stock_qty") or item.get("qty") or 1)
        if qty < 1:
            qty = 1

        token_dict = build_token_dict(item, company_name=company_name)
        single_label_script = safe_template_substitute(template_to_use, token_dict)

        # Repeat label output according to quantity
        for _ in range(qty):
            prn_chunks.append(single_label_script)
            total_labels += 1

    combined_prn = "\n".join(prn_chunks)

    return {
        "prn": combined_prn,
        "total_labels": total_labels,
        "items_processed": len(items),
        "protocol": lang
    }
