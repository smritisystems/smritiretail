"""
Tattly Threads Dispatch Import & Tax Invoice Lifecycle Service

Authoritative source workbook:
F:\\Smriti-Clients Data\\Tattly Threads\\Invoice\\RIL_Dispatch_09-08-2026.xlsx

Key Architecture Directives:
1. Excel workbook is strictly READ-ONLY.
2. SKU rule: Article + Color + Size (e.g. CH-24-G-BLACK-36). Barcode is optional.
3. Import ≠ Invoice: Importing dispatch records creates/updates Products and Customer Sites only.
4. Invoice grouping: Grouped by statutory billing dimensions (Customer GSTIN / Place of Supply / SIS Code).
5. Invoice sequence safety: FY 2026-2027 sequence starts after sequence 17 (TT2026-2027/18).
6. Target Company DB: smriti_company_tattly_threads.
"""

import os
import uuid
import datetime
from decimal import Decimal
from dataclasses import dataclass
from typing import Dict, Any, List, Optional
try:
    import pandas as pd
    import openpyxl
except ImportError:
    pd = None
    openpyxl = None

from sqlalchemy import select, func, text, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company
from app.models.crm import Customer
from app.models.inventory import Product
from app.models.sales import SalesInvoice, SalesInvoiceItem

DISPATCH_EXCEL_PATH = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\RIL_Dispatch_09-08-2026.xlsx"
SIZE_COLS = [36, 37, 38, 39, 40, 41, 42]

VERIFIED_SIS_PO_MAP: Dict[str, str] = {
    # Official Purchase Order Registry Mapping
    "V051": "5182778210",
    "1888": "5182778151",
    "1969": "5182778152",
    "1977": "5182778153",
    "8155": "5182778154",
    "8313": "5182778155",
    "8361": "5182778156",
    "9556": "5182778157",
    "S4NN": "5182778158",
    "T0N6": "5182778159",
    "T0NG": "5182778159",
    "T1BJ": "5182778160",
    "T25I": "5182778161",
    "T38X": "5182778162",
    "T40K": "5182778163",
    "T40R": "5182778164",
    "T51H": "5182778165",
    "T72W": "5182778166",
    "T7FN": "5182778167",
    "T8IY": "5182778168",
    "T81Y": "5182778168",
    "T97D": "5182778169",
    "T9IM": "5182778170",
    "T91M": "5182778170",
    "T9SQ": "5182778171",
    "TA0A": "5182778172",
    "TAGG": "5182778173",
    "TAGH": "5182778174",
    "TAMI": "5182778175",
    "TC64": "5182778176",
    "TDL2": "5182778177",
    "TDL3": "5182778178",
    "TDL6": "5182778179",
    "TDL9": "5182778180",

    # orderno2.jpeg
    "TDM4": "5182778181",
    "TFW4": "5182778182",
    "TGX1": "5182778183",
    "TGX9": "5182778184",
    "TJI4": "5182778185",
    "TRF4": "5182778186",
    "TKF4": "5182778186",
    "TKG3": "5182778187",
    "TKI6": "5182778188",
    "TKLO": "5182778189",
    "TKL0": "5182778189",
    "TKU5": "5182778190",
    "TKU6": "5182778191",
    "TMN2": "5182778192",
    "TMV9": "5182778193",
    "TMW3": "5182778194",
    "TPV2": "5182778195",
    "TUA7": "5182778196",
    "TUB7": "5182778197",
    "TUK5": "5182778198",
    "TV81": "5182778199",
    "TVB6": "5182778200",
    "TVP2": "5182778201",
    "TVT0": "5182778202",
    "TVU1": "5182778203",
    "TW97": "5182778204",
    "TXAJ": "5182778205",
    "TXSR": "5182778206",
    "TXSU": "5182778207",
    "TY06": "5182778208",
    "TYAC": "5182778209",
    "V051": "5182778210",
    "TV78": "5182778210"
}


def get_po_number_for_sis(sis_code: Optional[str]) -> str:
    if not sis_code:
        return ""
    clean = str(sis_code).strip()
    return VERIFIED_SIS_PO_MAP.get(clean, "")


@dataclass
class LineItemInput:
    product_id: str
    quantity: float
    unit_price: float
    hsn_code: str = "64041990"
    tax_rate: float = 18.0


@dataclass
class CalculatedLineItem:
    product_id: str
    quantity: float
    unit_price: float
    taxable_amount: float
    tax_rate: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    line_total: float


@dataclass
class InvoiceCalculationResult:
    is_interstate: bool
    subtotal: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_tax: float
    grand_total: float
    items: List[CalculatedLineItem]


def calculate_tax_invoice(
    seller_state: str,
    place_of_supply: str,
    items: List[LineItemInput]
) -> InvoiceCalculationResult:
    seller_st = str(seller_state).strip().upper()
    pos_st = str(place_of_supply).strip().upper()

    # Inter-state if seller state code does not match place of supply state code/name
    is_interstate = (seller_st != pos_st and seller_st[:2] != pos_st[:2])

    calc_items = []
    subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_igst = 0.0

    for it in items:
        taxable = round(it.quantity * it.unit_price, 2)
        subtotal += taxable

        if is_interstate:
            igst = round((taxable * it.tax_rate) / 100.0, 2)
            cgst = 0.0
            sgst = 0.0
        else:
            cgst = round((taxable * (it.tax_rate / 2.0)) / 100.0, 2)
            sgst = round((taxable * (it.tax_rate / 2.0)) / 100.0, 2)
            igst = 0.0

        line_tot = round(taxable + cgst + sgst + igst, 2)

        total_cgst += cgst
        total_sgst += sgst
        total_igst += igst

        calc_items.append(CalculatedLineItem(
            product_id=it.product_id,
            quantity=it.quantity,
            unit_price=it.unit_price,
            taxable_amount=taxable,
            tax_rate=it.tax_rate,
            cgst_amount=cgst,
            sgst_amount=sgst,
            igst_amount=igst,
            line_total=line_tot
        ))

    subtotal = round(subtotal, 2)
    total_cgst = round(total_cgst, 2)
    total_sgst = round(total_sgst, 2)
    total_igst = round(total_igst, 2)
    total_tax = round(total_cgst + total_sgst + total_igst, 2)
    grand_total = round(subtotal + total_tax, 2)

    return InvoiceCalculationResult(
        is_interstate=is_interstate,
        subtotal=subtotal,
        cgst_amount=total_cgst,
        sgst_amount=total_sgst,
        igst_amount=total_igst,
        total_tax=total_tax,
        grand_total=grand_total,
        items=calc_items
    )


class TattlyDispatchImportService:
    @staticmethod
    def inspect_dispatch_workbook(file_path: str = DISPATCH_EXCEL_PATH) -> Dict[str, Any]:
        """
        Audits the dispatch workbook without modifying data or database.
        Returns exact counts and structural breakdown.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Source dispatch file not found: {file_path}")

        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet_names = wb.sheetnames
        df = pd.read_excel(file_path, sheet_name=sheet_names[0])

        rows_count = len(df)
        cols_count = len(df.columns)
        columns = [str(c) for c in df.columns]

        duplicate_rows = int(df.duplicated().sum())

        missing_counts = {str(k): int(v) for k, v in df.isnull().sum().to_dict().items()}

        articles = sorted(df['ARTICLE'].astype(str).str.strip().unique().tolist())
        colors = sorted(df['COLOR'].astype(str).str.strip().str.upper().unique().tolist())
        mrps = sorted([float(x) for x in df['MRP'].unique().tolist()])

        size_qty = {}
        total_pcs = 0
        for s in SIZE_COLS:
            q = int(df[s].fillna(0).sum())
            size_qty[str(s)] = q
            total_pcs += q

        # Unpivot line items
        unpivoted_items = []
        for idx, row in df.iterrows():
            sis_code = str(row['SIS Code']).strip()
            art = str(row['ARTICLE']).strip()
            col = str(row['COLOR']).strip().upper()
            mrp = float(row['MRP'])
            pkg_date = str(row['Packing date'])
            cartoon = int(row['Cartoon number'])

            for sz in SIZE_COLS:
                qty = row[sz]
                if pd.notna(qty) and int(qty) > 0:
                    sku = f"{art}-{col}-{sz}"
                    unpivoted_items.append({
                        "row_index": idx,
                        "sis_code": sis_code,
                        "article": art,
                        "color": col,
                        "size": str(sz),
                        "sku": sku,
                        "mrp": mrp,
                        "qty": int(qty),
                        "packing_date": pkg_date,
                        "cartoon_number": cartoon
                    })

        melted_df = pd.DataFrame(unpivoted_items)
        unique_skus = sorted(melted_df['sku'].unique().tolist()) if len(melted_df) > 0 else []
        dispatch_sis_codes = sorted(df['SIS Code'].astype(str).str.strip().unique().tolist())

        return {
            "file_path": file_path,
            "sheet_count": len(sheet_names),
            "sheet_names": sheet_names,
            "data_rows_count": rows_count,
            "columns_count": cols_count,
            "columns": columns,
            "duplicate_matrix_rows": duplicate_rows,
            "missing_values_count": missing_counts,
            "unique_articles_count": len(articles),
            "unique_articles": articles,
            "unique_colors_count": len(colors),
            "unique_colors": colors,
            "unique_mrps": mrps,
            "size_quantity_breakdown": size_qty,
            "total_pieces": total_pcs,
            "total_unpivoted_line_items": len(unpivoted_items),
            "unique_sku_count": len(unique_skus),
            "unique_sis_codes_count": len(dispatch_sis_codes),
            "unique_sis_codes": dispatch_sis_codes,
            "inspection_status": "SUCCESS"
        }

    @staticmethod
    async def import_dispatch_items_and_sites(
        db_session: AsyncSession,
        file_path: str = DISPATCH_EXCEL_PATH
    ) -> Dict[str, Any]:
        """
        Idempotently imports Product SKUs (Article-Color-Size) and CustomerAddress site records
        into smriti_company_tattly_threads.
        Does NOT create or finalize tax invoices.
        """
        audit_res = TattlyDispatchImportService.inspect_dispatch_workbook(file_path)
        df = pd.read_excel(file_path, sheet_name=audit_res["sheet_names"][0])

        # 1. Fetch Legal Customer (Reliance Retail Limited)
        cust_stmt = select(Customer).where(Customer.name == "Reliance Retail Limited")
        cust_res = await db_session.execute(cust_stmt)
        customer = cust_res.scalar_one_or_none()
        if not customer:
            customer = Customer(
                id=f"cust-{uuid.uuid4().hex[:12]}",
                name="Reliance Retail Limited",
                code="CUST-RRL-001",
                is_active=True
            )
            db_session.add(customer)
            await db_session.flush()

        # 2. Process Customer Sites (SIS Codes)
        sites_stmt = select(CustomerAddress).where(CustomerAddress.customer_id == customer.id)
        existing_sites = list((await db_session.execute(sites_stmt)).scalars().all())
        site_map = {s.site_code: s for s in existing_sites if s.site_code}

        new_sites_created = 0
        dispatch_sis_codes = audit_res["unique_sis_codes"]
        for sis in dispatch_sis_codes:
            if sis not in site_map:
                new_site = CustomerAddress(
                    id=f"site-{uuid.uuid4().hex[:12]}",
                    customer_id=customer.id,
                    branch_id=None,
                    site_code=sis,
                    site_name=f"Reliance Retail Site ({sis})",
                    format_type="RELIANCE_RETAIL_SITE",
                    street=f"Reliance Retail Store, SIS Code {sis}",
                    city="Mumbai",
                    state="Maharashtra",
                    pincode="400001",
                    country="India",
                    gstin_status="NOT_PROVIDED_IN_SOURCE",
                    tax_profile_id=None,
                    is_active=True
                )
                db_session.add(new_site)
                site_map[sis] = new_site
                new_sites_created += 1

        if new_sites_created > 0:
            await db_session.flush()

        # 3. Process Product SKUs (Article-Color-Size)
        prod_stmt = select(Product)
        existing_prods = list((await db_session.execute(prod_stmt)).scalars().all())
        prod_map = {p.sku: p for p in existing_prods if p.sku}

        new_prods_created = 0
        unpivoted_skus: Dict[str, Dict[str, Any]] = {}

        for _, row in df.iterrows():
            art = str(row['ARTICLE']).strip()
            col = str(row['COLOR']).strip().upper()
            mrp = float(row['MRP'])

            for sz in SIZE_COLS:
                qty = row[sz]
                if pd.notna(qty) and int(qty) > 0:
                    sku = f"{art}-{col}-{sz}"
                    if sku not in unpivoted_skus:
                        unpivoted_skus[sku] = {
                            "article": art,
                            "color": col,
                            "size": str(sz),
                            "mrp": mrp
                        }

        for sku, meta in unpivoted_skus.items():
            if sku not in prod_map:
                new_prod = Product(
                    id=f"prod-{uuid.uuid4().hex[:12]}",
                    code=sku,
                    sku=sku,
                    name=f"Tattly Footwear {meta['article']} {meta['color']} Size {meta['size']}",
                    category="Footwear",
                    barcode=f"BAR-{uuid.uuid4().hex[:12]}",
                    style_code=meta['article'],
                    color=meta['color'],
                    size=meta['size'],
                    price=round(meta['mrp'] / 1.18, 2),
                    mrp=meta['mrp'],
                    gst_percentage=18.0,
                    hsn_code="64041990",
                    is_active=True
                )
                db_session.add(new_prod)
                prod_map[sku] = new_prod
                new_prods_created += 1

        await db_session.commit()

        return {
            "status": "SUCCESS",
            "customer_id": customer.id,
            "customer_name": customer.name,
            "total_dispatch_sis_codes": len(dispatch_sis_codes),
            "new_sites_created": new_sites_created,
            "total_sites_in_db": len(site_map),
            "total_unique_skus_discovered": len(unpivoted_skus),
            "new_products_created": new_prods_created,
            "total_products_in_db": len(prod_map)
        }

    @staticmethod
    async def preview_tax_invoices(
        db_session: AsyncSession,
        group_by: str = "GSTIN",
        file_path: str = DISPATCH_EXCEL_PATH
    ) -> List[Dict[str, Any]]:
        """
        Groups dispatch items by statutory billing dimension (GSTIN / Place of Supply / SIS Code)
        and calculates candidate tax invoice totals without writing to database.
        """
        audit_res = TattlyDispatchImportService.inspect_dispatch_workbook(file_path)
        df = pd.read_excel(file_path, sheet_name=audit_res["sheet_names"][0])

        cust_stmt = select(Customer).where(Customer.name == "Reliance Retail Limited")
        cust_res = await db_session.execute(cust_stmt)
        customer = cust_res.scalar_one_or_none()

        sites_stmt = select(CustomerAddress).where(CustomerAddress.customer_id == customer.id if customer else text("1=1"))
        sites = list((await db_session.execute(sites_stmt)).scalars().all())
        site_map = {s.site_code: s for s in sites if s.site_code}

        tax_stmt = select(CustomerTaxProfile)
        tax_profiles = {t.id: t for t in (await db_session.execute(tax_stmt)).scalars().all()}

        seller_state_code = "27"

        grouped_records: Dict[str, List[Dict[str, Any]]] = {}

        for idx, row in df.iterrows():
            sis_code = str(row['SIS Code']).strip()
            art = str(row['ARTICLE']).strip()
            col = str(row['COLOR']).strip().upper()
            mrp = float(row['MRP'])
            rate = round(mrp / 1.18, 2)

            site_obj = site_map.get(sis_code)
            tp_obj = tax_profiles.get(site_obj.tax_profile_id) if (site_obj and site_obj.tax_profile_id) else None

            buyer_gstin = tp_obj.gstin if tp_obj else "NO_GSTIN"
            buyer_state = tp_obj.state_name if (tp_obj and tp_obj.state_name) else (site_obj.state if site_obj else "Maharashtra")
            buyer_state_code = tp_obj.state_code if tp_obj else "27"

            if group_by == "SIS":
                group_key = f"SIS-{sis_code}"
            else:
                group_key = f"GSTIN-{buyer_gstin}" if buyer_gstin != "NO_GSTIN" else f"STATE-{buyer_state}"

            if group_key not in grouped_records:
                grouped_records[group_key] = []

            for sz in SIZE_COLS:
                qty = row[sz]
                if pd.notna(qty) and int(qty) > 0:
                    sku = f"{art}-{col}-{sz}"
                    grouped_records[group_key].append({
                        "sis_code": sis_code,
                        "article": art,
                        "color": col,
                        "size": str(sz),
                        "sku": sku,
                        "mrp": mrp,
                        "rate": rate,
                        "qty": int(qty),
                        "buyer_gstin": buyer_gstin,
                        "buyer_state": buyer_state,
                        "buyer_state_code": buyer_state_code,
                        "site_name": site_obj.site_name if site_obj else f"Site ({sis_code})"
                    })

        previews = []
        for gkey, items in grouped_records.items():
            first_item = items[0]
            total_qty = sum(it["qty"] for it in items)

            engine_inputs = [
                LineItemInput(
                    product_id=it["sku"],
                    quantity=float(it["qty"]),
                    unit_price=it["rate"],
                    hsn_code="64041990",
                    tax_rate=18.0
                )
                for it in items
            ]

            inv_calculation = calculate_tax_invoice(
                seller_state=seller_state_code,
                place_of_supply=first_item["buyer_state_code"],
                items=engine_inputs
            )

            sis_list = sorted(list(set(it["sis_code"] for it in items)))
            po_ref = get_po_number_for_sis(sis_list[0]) if sis_list else ""

            previews.append({
                "group_key": gkey,
                "sis_codes": sis_list,
                "buyer_gstin": first_item["buyer_gstin"],
                "place_of_supply_state": first_item["buyer_state"],
                "place_of_supply_state_code": first_item["buyer_state_code"],
                "is_interstate": inv_calculation.is_interstate,
                "total_line_items": len(items),
                "total_quantity": total_qty,
                "subtotal_taxable_value": inv_calculation.subtotal,
                "cgst_amount": inv_calculation.cgst_amount,
                "sgst_amount": inv_calculation.sgst_amount,
                "igst_amount": inv_calculation.igst_amount,
                "total_tax": inv_calculation.total_tax,
                "grand_total": inv_calculation.grand_total,
                "po_so_number": po_ref,
                "po_order_reference": po_ref,
                "dispatch_email": "dispatch@tattlythreads.com",
                "accounts_email": "accounts@tattlythreads.com"
            })

        return previews

    @staticmethod
    async def get_next_invoice_number(db_session: AsyncSession, financial_year: str = "2026-2027") -> Dict[str, Any]:
        """
        Determines the next transaction-safe invoice sequence number for FY 2026-2027.
        Baseline: Last issued sequence was 17 (TT2026-2027/17). Expected next: 18 (TT2026-2027/18).
        """
        prefix = f"TT{financial_year}/"
        stmt = select(SalesInvoice.invoice_no).where(SalesInvoice.invoice_no.like(f"{prefix}%"))
        res = await db_session.execute(stmt)
        existing_numbers = list(res.scalars().all())

        max_seq = 17  # Official baseline minimum sequence
        for num in existing_numbers:
            try:
                seq_str = num.split("/")[-1]
                seq_val = int(seq_str)
                if seq_val > max_seq:
                    max_seq = seq_val
            except (ValueError, IndexError):
                pass

        next_seq = max_seq + 1
        next_invoice_no = f"TT{financial_year}/{next_seq}"

        return {
            "financial_year": financial_year,
            "last_issued_sequence": max_seq,
            "next_sequence": next_seq,
            "next_invoice_number": next_invoice_no
        }

    @staticmethod
    async def create_tax_invoice(
        db_session: AsyncSession,
        group_key: Optional[str] = None,
        sis_code: Optional[str] = None,
        invoice_date: str = "2026-08-12",
        po_so_number: str = "Not Provided",
        financial_year: str = "2026-2027",
        file_path: str = DISPATCH_EXCEL_PATH
    ) -> Dict[str, Any]:
        """
        Creates a real backend-allocated Tax Invoice in smriti_company_tattly_threads.
        Consumes next sequence TT2026-2027/18 (or higher).
        """
        comp_stmt = select(Company).where(Company.company_code == "tattly_threads")
        seller = (await db_session.execute(comp_stmt)).scalar_one_or_none()
        seller_state_code = "27"

        seq_info = await TattlyDispatchImportService.get_next_invoice_number(db_session, financial_year)
        invoice_no = seq_info["next_invoice_number"]
        sequence_num = seq_info["next_sequence"]

        audit_res = TattlyDispatchImportService.inspect_dispatch_workbook(file_path)
        df = pd.read_excel(file_path, sheet_name=audit_res["sheet_names"][0])

        if sis_code:
            df = df[df['SIS Code'].astype(str).str.strip() == str(sis_code).strip()]

        if len(df) == 0:
            raise ValueError(f"No dispatch records found matching filter (SIS Code: {sis_code})")

        cust_stmt = select(Customer).where(Customer.name == "Reliance Retail Limited")
        customer = (await db_session.execute(cust_stmt)).scalar_one_or_none()
        if not customer:
            raise ValueError("Reliance Retail Limited customer record not found. Run import first.")

        target_sis = str(df.iloc[0]['SIS Code']).strip()
        
        # Auto-resolve PO / Order Reference number from verified mapping if not explicitly supplied
        resolved_po = po_so_number if (po_so_number and po_so_number != "Not Provided") else get_po_number_for_sis(target_sis)

        site_stmt = select(CustomerAddress).where(
            and_(CustomerAddress.customer_id == customer.id, CustomerAddress.site_code == target_sis)
        )
        site_obj = (await db_session.execute(site_stmt)).scalar_one_or_none()

        tp_obj = None
        if site_obj and site_obj.tax_profile_id:
            tp_stmt = select(CustomerTaxProfile).where(CustomerTaxProfile.id == site_obj.tax_profile_id)
            tp_obj = (await db_session.execute(tp_stmt)).scalar_one_or_none()

        buyer_gstin = tp_obj.gstin if tp_obj else "NO_GSTIN"
        buyer_state = tp_obj.state_name if (tp_obj and tp_obj.state_name) else (site_obj.state if site_obj else "Maharashtra")
        buyer_state_code = tp_obj.state_code if tp_obj else "27"

        line_items_data = []
        for idx, row in df.iterrows():
            art = str(row['ARTICLE']).strip()
            col = str(row['COLOR']).strip().upper()
            mrp = float(row['MRP'])
            rate = round(mrp / 1.18, 2)

            for sz in SIZE_COLS:
                qty = row[sz]
                if pd.notna(qty) and int(qty) > 0:
                    sku = f"{art}-{col}-{sz}"
                    line_items_data.append({
                        "sku": sku,
                        "article": art,
                        "color": col,
                        "size": str(sz),
                        "mrp": mrp,
                        "rate": rate,
                        "qty": int(qty)
                    })

        engine_inputs = [
            LineItemInput(
                product_id=it["sku"],
                quantity=float(it["qty"]),
                unit_price=it["rate"],
                hsn_code="64041990",
                tax_rate=18.0
            )
            for it in line_items_data
        ]

        inv_calc = calculate_tax_invoice(
            seller_state=seller_state_code,
            place_of_supply=buyer_state_code,
            items=engine_inputs
        )

        parsed_date = datetime.datetime.strptime(invoice_date, "%Y-%m-%d")

        notes_str = f"Tattly Threads Tax Invoice | SIS Code: {target_sis}"
        if resolved_po:
            notes_str += f" | PO / Order Reference No.: {resolved_po}"

        sales_invoice = SalesInvoice(
            id=f"inv-{uuid.uuid4().hex[:12]}",
            company_id=seller.id if seller else None,
            branch_id=None,
            customer_id=customer.id,
            billing_site_id=site_obj.id if site_obj else None,
            shipping_site_id=site_obj.id if site_obj else None,
            invoice_no=invoice_no,
            invoice_date=parsed_date,
            status="Paid",
            subtotal=inv_calc.subtotal,
            tax_total=inv_calc.total_tax,
            cgst_amount=inv_calc.cgst_amount,
            sgst_amount=inv_calc.sgst_amount,
            igst_amount=inv_calc.igst_amount,
            discount_amount=0.0,
            grand_total=inv_calc.grand_total,
            paid_amount=inv_calc.grand_total,
            balance_due=0.0,
            notes=notes_str
        )
        db_session.add(sales_invoice)
        await db_session.flush()

        prod_stmt = select(Product)
        prods = list((await db_session.execute(prod_stmt)).scalars().all())
        prod_map = {p.sku: p for p in prods if p.sku}

        for idx, (it, calc_item) in enumerate(zip(line_items_data, inv_calc.items)):
            prod_obj = prod_map.get(it["sku"])
            p_id = prod_obj.id if prod_obj else None
            if not p_id:
                new_p = Product(
                    id=f"prod-{uuid.uuid4().hex[:12]}",
                    code=it["sku"],
                    sku=it["sku"],
                    name=f"Tattly Footwear {it['article']} {it['color']} Size {it['size']}",
                    category="Footwear",
                    barcode=f"BAR-{uuid.uuid4().hex[:12]}",
                    style_code=it['article'],
                    color=it['color'],
                    size=it['size'],
                    price=round(it['mrp'] / 1.18, 2),
                    mrp=it['mrp'],
                    gst_percentage=18.0,
                    hsn_code="64041990",
                    is_active=True
                )
                db_session.add(new_p)
                await db_session.flush()
                p_id = new_p.id
                prod_map[it["sku"]] = new_p

            inv_item = SalesInvoiceItem(
                invoice_id=sales_invoice.id,
                product_id=p_id,
                code=it["sku"],
                name=f"Tattly Footwear {it['article']} {it['color']} Size {it['size']}",
                quantity=Decimal(str(it["qty"])),
                unit_price=Decimal(str(it["rate"])),
                hsn_code="64041990",
                gst_rate=Decimal("18.00"),
                gst_percentage=Decimal("18.00"),
                tax_amount=Decimal(str(round(calc_item.cgst_amount + calc_item.sgst_amount + calc_item.igst_amount, 2))),
                cgst_amount=Decimal(str(calc_item.cgst_amount)),
                sgst_amount=Decimal(str(calc_item.sgst_amount)),
                igst_amount=Decimal(str(calc_item.igst_amount)),
                line_total=Decimal(str(calc_item.line_total))
            )
            db_session.add(inv_item)

        await db_session.commit()

        return {
            "status": "SUCCESS",
            "invoice_id": sales_invoice.id,
            "invoice_number": invoice_no,
            "invoice_sequence": sequence_num,
            "financial_year": financial_year,
            "invoice_date": invoice_date,
            "seller_name": "Tattly Threads",
            "seller_gstin": "27AAXFT2508H1ZR",
            "customer_name": customer.name,
            "customer_pan": "AABCR1718E",
            "sis_code": target_sis,
            "buyer_gstin": buyer_gstin,
            "place_of_supply": buyer_state,
            "place_of_supply_code": buyer_state_code,
            "is_interstate": inv_calc.is_interstate,
            "po_so_number": resolved_po,
            "po_order_reference": resolved_po,
            "total_line_items": len(line_items_data),
            "total_quantity": sum(it["qty"] for it in line_items_data),
            "subtotal_taxable_value": inv_calc.subtotal,
            "cgst_amount": inv_calc.cgst_amount,
            "sgst_amount": inv_calc.sgst_amount,
            "igst_amount": inv_calc.igst_amount,
            "total_tax": inv_calc.total_tax,
            "grand_total": inv_calc.grand_total,
            "dispatch_email": "dispatch@tattlythreads.com",
            "accounts_email": "accounts@tattlythreads.com"
        }
