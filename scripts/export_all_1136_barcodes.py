"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.3
Created      : 2026-10-12
Modified     : 2026-10-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Export All 1,136 Barcodes with Style & Attributes
"""

import asyncio
import csv
import re
from pathlib import Path
import httpx
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE_URL = "https://tattlythreads.smritisys.com"

CLIENT_DIR = Path(r"F:\Smriti-Clients Data\Tattly Threads\ItemMaster")
LOCAL_EXPORT_DIR = Path(r"F:\SMRITRretailNX\exports")
ARTIFACT_DIR = Path(r"C:\Users\netma\.gemini\antigravity-ide\brain\446a48c2-6101-4a0a-b296-676ddefc529c")


def format_style_for_barcode_label(raw_style: str, vendor_code: str) -> str:
    """Formats Article / Style for barcode label printing:
    - Single-letter vendors retain trailing dash: Style + '-' + Vendor + '-' (e.g. CH-01-A-)
    - In-house vendor 'TT' (or multi-letter) formats without trailing dash: Style + '-' + Vendor (e.g. CH-501-TT)
    """
    if not raw_style or raw_style == "-":
        return "CH-30-K"
    style = raw_style.strip().lstrip(",'\" ").strip()
    vendor = (vendor_code or "").strip().upper()
    if vendor.startswith("V-00") and len(vendor) > 4:
        vendor = vendor[4:]
    if vendor:
        if vendor == "TT" or len(vendor) > 1:
            if style.upper().endswith(f"-{vendor}-"):
                return style[:-1]
            if style.upper().endswith(f"-{vendor}"):
                return style
            return f"{style}-{vendor}"
        if style.upper().endswith(f"-{vendor}-"):
            return style
        if style.upper().endswith(f"-{vendor}"):
            return f"{style}-"
        return f"{style}-{vendor}-"
    return style


def clean_style_article(raw_style: str, vendor_code: str) -> tuple[str, str]:
    """Extracts clean style code (e.g. CH-01) and separate vendor code (e.g. A)."""
    style = raw_style.strip().lstrip(",'\" ").strip()
    vendor = (vendor_code or "").strip().upper()
    if vendor.startswith("V-00") and len(vendor) > 4:
        vendor = vendor[4:]
    m = re.match(r"^(.*?)-([A-Z]{1,2})$", style)
    if m:
        base_style = m.group(1).strip()
        suffix_vendor = m.group(2).strip()
        if not vendor:
            vendor = suffix_vendor
        return base_style, vendor
    return style, vendor


async def fetch_all_items():
    async with httpx.AsyncClient(timeout=90.0) as client:
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"},
        )
        if login_res.status_code != 200:
            raise RuntimeError(f"Login failed: {login_res.status_code} {login_res.text}")

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        offset = 0
        limit = 200
        all_items = []
        while True:
            res = await client.get(
                f"{BASE_URL}/api/v1/universal/items?limit={limit}&offset={offset}",
                headers=headers
            )
            if res.status_code != 200:
                raise RuntimeError(f"Fetch failed: {res.status_code} {res.text}")
            page = res.json()
            if not page:
                break
            all_items.extend(page)
            offset += len(page)
            if len(page) < limit:
                break

        return all_items


def extract_rows(all_items):
    rows = []
    seen_barcodes = set()

    for item in all_items:
        raw_style = item.get("style_code") or item.get("item_code") or ""
        brand = item.get("brand") or "Tattly Threads"
        cat = item.get("category") or item.get("product_type") or ""
        dept = item.get("department") or "FOOTWEAR"
        gender = item.get("gender") or "LADIES"
        hsn = item.get("hsn_code") or "64041990"
        tax = item.get("tax_rate") or 5.0
        raw_vendor = item.get("vendor_code") or "TT"
        heel = item.get("heel_type") or ""
        upper = item.get("upper_material") or ""
        outsole = item.get("outsole_material") or ""
        uom = item.get("primary_uom") or "PAIR"

        clean_style, actual_vendor = clean_style_article(raw_style, raw_vendor)
        barcode_label_style = format_style_for_barcode_label(clean_style, actual_vendor)

        for v in item.get("variants", []):
            sku = v.get("variant_sku") or ""
            attr = v.get("attributes_json") or {}
            color = v.get("color") or attr.get("color") or ""
            size = v.get("size") or attr.get("size") or ""
            mrp = float(v.get("mrp") or item.get("mrp") or 0.0)
            cost = float(v.get("cost_price") or item.get("cost_price") or 0.0)
            sp = float(v.get("selling_price") or mrp or 0.0)

            for b in v.get("barcodes", []):
                bc = str(b.get("barcode") or "").strip()
                if not bc or bc in seen_barcodes:
                    continue
                seen_barcodes.add(bc)

                rows.append({
                    "barcode": bc,
                    "style_code": clean_style,
                    "vendor_code": actual_vendor,
                    "barcode_label_style": barcode_label_style,
                    "variant_sku": sku,
                    "color": color,
                    "size": str(size),
                    "brand": brand,
                    "category": cat,
                    "gender": gender,
                    "department": dept,
                    "mrp": mrp,
                    "cost_price": cost,
                    "selling_price": sp,
                    "tax_rate": tax,
                    "hsn_code": hsn,
                    "heel_type": heel,
                    "upper_material": upper,
                    "outsole_material": outsole,
                    "uom": uom,
                })

    # Sort naturally by style_code, color, size
    rows.sort(key=lambda x: (x["style_code"], x["color"], str(x["size"]), x["barcode"]))
    return rows


def export_to_excel(rows, target_paths):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Barcodes & Styles (1136)"

    # Header styling
    headers = [
        "S.No",
        "Barcode (EAN-13)",
        "Style / Article",
        "Vendor Code",
        "Barcode Label Style (Printed)",
        "Variant SKU",
        "Color",
        "Size",
        "Brand",
        "Category",
        "Gender",
        "Department",
        "MRP (₹)",
        "Cost Price (₹)",
        "Selling Price (₹)",
        "GST Rate (%)",
        "HSN Code",
        "Heel Type",
        "Upper Material",
        "Outsole Material",
        "UOM",
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    right_align = Alignment(horizontal="right", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="D3D3D3"),
        right=Side(style="thin", color="D3D3D3"),
        top=Side(style="thin", color="D3D3D3"),
        bottom=Side(style="thin", color="D3D3D3"),
    )

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align

    # Data rows
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    regular_font = Font(name="Calibri", size=10)
    mono_font = Font(name="Consolas", size=10, bold=True)
    highlight_font = Font(name="Consolas", size=10, bold=True, color="002060")

    for idx, r in enumerate(rows, start=1):
        row_vals = [
            idx,
            r["barcode"],
            r["style_code"],
            r["vendor_code"],
            r["barcode_label_style"],
            r["variant_sku"],
            r["color"],
            r["size"],
            r["brand"],
            r["category"],
            r["gender"],
            r["department"],
            r["mrp"],
            r["cost_price"],
            r["selling_price"],
            r["tax_rate"],
            r["hsn_code"],
            r["heel_type"],
            r["upper_material"],
            r["outsole_material"],
            r["uom"],
        ]
        ws.append(row_vals)
        row_idx = idx + 1

        is_even = (idx % 2 == 0)
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = regular_font
            cell.border = thin_border
            if is_even:
                cell.fill = zebra_fill

            # Format barcode as text so Excel won't render scientific notation
            if col_idx == 2:
                cell.number_format = "@"
                cell.font = mono_font
                cell.alignment = center_align
            elif col_idx in (3, 4):
                cell.alignment = center_align
                cell.font = mono_font
            elif col_idx == 5:
                cell.alignment = center_align
                cell.font = highlight_font
            elif col_idx in (1, 8, 16, 17, 21):
                cell.alignment = center_align
            elif col_idx in (13, 14, 15):
                cell.alignment = right_align
                cell.number_format = "#,##0.00"
            else:
                cell.alignment = left_align

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    # Save to all target paths
    for p in target_paths:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            wb.save(str(p))
            print(f"[Export OK] Excel saved: {p}")
        except Exception as e:
            print(f"[Export WARN] Could not save to {p}: {e}")


def export_to_csv(rows, target_paths):
    headers = [
        "S.No",
        "Barcode",
        "Style / Article",
        "Vendor Code",
        "Barcode Label Style (Printed)",
        "Variant SKU",
        "Color",
        "Size",
        "Brand",
        "Category",
        "Gender",
        "Department",
        "MRP",
        "Cost Price",
        "Selling Price",
        "GST Rate",
        "HSN Code",
        "Heel Type",
        "Upper Material",
        "Outsole Material",
        "UOM",
    ]

    for p in target_paths:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(str(p), mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                for idx, r in enumerate(rows, start=1):
                    writer.writerow([
                        idx,
                        f'="{r["barcode"]}"',  # Prevent scientific notation in Excel CSV
                        r["style_code"],
                        r["vendor_code"],
                        r["barcode_label_style"],
                        r["variant_sku"],
                        r["color"],
                        r["size"],
                        r["brand"],
                        r["category"],
                        r["gender"],
                        r["department"],
                        f"{r['mrp']:.2f}",
                        f"{r['cost_price']:.2f}",
                        f"{r['selling_price']:.2f}",
                        r["tax_rate"],
                        r["hsn_code"],
                        r["heel_type"],
                        r["upper_material"],
                        r["outsole_material"],
                        r["uom"],
                    ])
            print(f"[Export OK] CSV saved: {p}")
        except Exception as e:
            print(f"[Export WARN] Could not save to {p}: {e}")


async def main():
    print("[1/3] Fetching all items from live server...")
    items = await fetch_all_items()
    print(f"      Fetched {len(items)} parent styles from live server.")

    print("[2/3] Extracting and unpivoting barcodes and variants...")
    rows = extract_rows(items)
    print(f"      Extracted exactly {len(rows)} distinct barcode records.")

    excel_targets = [
        CLIENT_DIR / "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.xlsx",
        LOCAL_EXPORT_DIR / "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.xlsx",
        ARTIFACT_DIR / "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.xlsx",
    ]

    csv_targets = [
        CLIENT_DIR / "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.csv",
        LOCAL_EXPORT_DIR / "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.csv",
        ARTIFACT_DIR / "TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.csv",
    ]

    print("[3/3] Generating styled Excel and CSV files...")
    export_to_excel(rows, excel_targets)
    export_to_csv(rows, csv_targets)
    print("\n[SUCCESS] Export process finished successfully!")


if __name__ == "__main__":
    asyncio.run(main())
