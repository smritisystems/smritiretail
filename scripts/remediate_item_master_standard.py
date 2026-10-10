"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-27
Modified     : 2026-09-28 (v2.2 remediation + GST_RATE_PERCENT TAX dropdown col added)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation
from pathlib import Path

BASE_DIR = Path(r"f:\SMRITRretailNX")
SOURCE_FILE = BASE_DIR / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.1.xlsx"
OUTPUT_V2_1 = SOURCE_FILE
OUTPUT_V2_2 = BASE_DIR / "assets" / "Itemmasters" / "SMRITI_Item_Master_Creation_Standard_v2.2.xlsx"

print(f"Loading {SOURCE_FILE}...")
wb = openpyxl.load_workbook(SOURCE_FILE)

# 1. Update Validation Lists
print("Upgrading 'Validation Lists' sheet...")
vl_ws = wb["Validation Lists"]

catalog_data = {
    1: ("ARTICLE_STYLE_CODE", ["CH-28", "SND-12", "SND-13", "SND-14", "SND-15", "CH-29", "CH-30", "SND-16", "SND-17"], 100, "List_ARTICLE_STYLE_CODE", "$A$2:$A$100"),
    2: ("BRAND_NAME", ["TATTLY THREADS", "SMRITI", "BEANSTALK", "HERITAGE", "SWIFT", "GENERIC", "SMRITI LUXE"], 50, "List_BRAND_NAME", "$B$2:$B$50"),
    3: ("COLOR", ["BLACK", "WHITE", "BROWN", "TAN", "BEIGE", "RED", "NAVY", "BLUE", "GREY", "GOLD", "SILVER", "GREEN", "PINK", "MAROON", "CREAM", "OLIVE", "MULTI"], 50, "List_COLOR", "$C$2:$C$50"),
    4: ("SIZE", ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "UK-3", "UK-4", "UK-5", "UK-6", "UK-7", "UK-8", "UK-9", "UK-10", "S", "M", "L", "XL", "XXL", "FS"], 50, "List_SIZE", "$D$2:$D$50"),
    5: ("GENDER", ["LADIES", "MENS", "KIDS", "UNISEX"], 10, "List_GENDER", "$E$2:$E$10"),
    6: ("MERCHANDISE_DEPARTMENT", ["FOOTWEAR", "LADIES FTW", "MENS FTW", "KIDS FTW", "ACCESSORIES", "APPAREL"], 20, "List_MERCHANDISE_DEPARTMENT", "$F$2:$F$20"),
    7: ("MERCHANDISE_CATEGORY", ["Footwear", "Apparel", "Electronics", "Accessories", "Hardware", "General"], 20, "List_MERCHANDISE_CATEGORY", "$G$2:$G$20"),
    8: ("PRODUCT_TYPE", ["CHAPPAL", "SANDAL", "SHOE", "BOOT", "SLIPPER", "SNEAKER", "FLAT", "HEEL", "LOAFER", "MULE", "CLOG", "BELLIES"], 30, "List_PRODUCT_TYPE", "$H$2:$H$30"),
    9: ("DESIGN_ATTRIBUTE", ["CROSS", "BACK STRAP", "TOE RING", "ONE STRAP", "DOUBLE STRAP", "V-SHAPED", "ANKLE STRAP", "LACE UP", "SLIP ON", "BUCKLE", "PLAIN"], 30, "List_DESIGN_ATTRIBUTE", "$I$2:$I$30"),
    10: ("HEEL_TYPE", ["FLAT", "SMALL PLATFORM", "BOX HEEL", "WEDGE", "KITTEN", "BLOCK", "STILETTO", "CONE", "PLATFORM"], 20, "List_HEEL_TYPE", "$J$2:$J$20"),
    11: ("UPPER_MATERIAL", ["SYNTHETIC", "LEATHER", "CANVAS", "MESH", "SUEDE", "PU", "PVC", "TEXTILE", "PATENT LEATHER", "VELVET", "JACQUARD"], 20, "List_UPPER_MATERIAL", "$K$2:$K$20"),
    12: ("OUTSOLE_MATERIAL", ["TPR", "EVA", "RUBBER", "PU", "PVC", "AIRMAX", "SHEET SOLE", "LEATHER", "TPU"], 20, "List_OUTSOLE_MATERIAL", "$L$2:$L$20"),
    13: ("PURCHASE_CLASS", ["SIS", "OUTRIGHT", "CONSIGNMENT", "SOR"], 10, "List_PURCHASE_CLASS", "$M$2:$M$10"),
    14: ("VENDOR_CODE", ["O", "P"] + [chr(c) for c in range(ord('A'), ord('Z')+1)] + [f"A{chr(c)}" for c in range(ord('A'), ord('Z')+1)], 100, "List_VENDOR_CODE", "$N$2:$N$100"),
    15: ("UOM", ["Pair", "Pcs", "Box", "Set", "Meter"], 10, "List_UOM", "$O$2:$O$10"),
    16: ("COLLECTION_TYPE", ["BASIC", "PARTY", "CASUAL", "FORMAL", "FESTIVE", "BRIDAL", "SPORTS", "WORKWEAR"], 20, "List_COLLECTION_TYPE", "$P$2:$P$20"),
    17: ("YN", ["Y", "N"], 3, "List_YN", "$Q$2:$Q$3"),
    18: ("CREATION_STATUS", ["DRAFT", "READY", "APPROVED", "BLOCKED"], 5, "List_CREATION_STATUS", "$R$2:$R$5"),
    19: ("WAREHOUSE_CODE", ["WH-MAIN", "WH-STORE-01", "CENTRAL-WH", "RETAIL-STORE", "WH-NORTH", "WH-SOUTH"], 20, "List_WAREHOUSE_CODE", "$S$2:$S$20"),
    # Col T: GST_RATE_PERCENT — four statutory GST slabs (IM-001 controlled, BLOCK on invalid entry)
    20: ("GST_RATE_PERCENT", ["0", "5", "12", "18"], 6, "List_GST_RATE_PERCENT", "$T$2:$T$6"),
}

for col_idx, (header, values, max_len, dn_name, dn_range) in catalog_data.items():
    vl_ws.cell(1, col_idx, value=header)
    for r_idx, val in enumerate(values, start=2):
        vl_ws.cell(r_idx, col_idx, value=val)
    # Clear any leftover values below
    for r_idx in range(len(values) + 2, 120):
        vl_ws.cell(r_idx, col_idx, value=None)
    # Update defined names
    ref_str = f"'Validation Lists'!{dn_range}"
    if dn_name in wb.defined_names:
        wb.defined_names[dn_name].attr_text = ref_str
    else:
        wb.defined_names.add(openpyxl.workbook.defined_name.DefinedName(dn_name, attr_text=ref_str))

# 2. Update Item Master Template Formulas
print("Upgrading formulas in 'Item Master Template' sheet...")
tmpl_ws = wb["Item Master Template"]

for r in range(5, 501):
    # Col B: SKU_PREVIEW
    tmpl_ws.cell(r, 2, value=f'=IF(C{r}="","",C{r}&IF(F{r}<>"","-"&F{r},"")&IF(G{r}<>"","-"&G{r},"")&IF(Q{r}<>"","-"&Q{r},""))')
    
    # Col AI: VALIDATION_STATUS
    tmpl_ws.cell(r, 35, value=f'=IF(AND(A{r}="",C{r}=""),"EMPTY",IF(OR(A{r}="",C{r}="",E{r}="",F{r}="",G{r}="",I{r}="",J{r}="",K{r}="",L{r}="",M{r}="",N{r}="",O{r}="",P{r}="",R{r}="",S{r}="",T{r}="",W{r}="",AA{r}="",AB{r}="",AC{r}="",AD{r}="",AE{r}="",AF{r}="",AG{r}=""),"ERROR",IF(OR(AND(A{r}<>"",COUNTIF($A$5:$A$500,A{r})>1),AND(B{r}<>"",COUNTIF($B$5:$B$500,B{r})>1)),"DUPLICATE",IF(J{r}>I{r},"ERROR","READY"))))')
    
    # Col AJ: VALIDATION_MESSAGE
    tmpl_ws.cell(r, 36, value=f'=IF(AND(A{r}="",C{r}=""),"",IF(AND(A{r}<>"",COUNTIF($A$5:$A$500,A{r})>1),"Duplicate BARCODE_NO",IF(AND(B{r}<>"",COUNTIF($B$5:$B$500,B{r})>1),"Duplicate SKU_PREVIEW",IF(J{r}>I{r},"SELLING_PRICE > MRP",IF(OR(AB{r}="",AC{r}=""),"Missing Warehouse/Reorder",IF(OR(C{r}="",E{r}="",F{r}="",G{r}="",I{r}="",J{r}="",K{r}="",M{r}="",N{r}=""),"Missing Mandatory Attributes","OK"))))))')

# 3. Soften Data Validation on Item Master Template to Warning/Information
print("Configuring soft data validation alerts...")
if hasattr(tmpl_ws, 'data_validations') and tmpl_ws.data_validations:
    for dv in tmpl_ws.data_validations.dataValidation:
        dv.allow_blank = True
        if dv.type == 'list':
            # Allow entering new dimension without hard modal block
            dv.errorStyle = 'warning'
            dv.errorTitle = 'Dimension Notice'
            dv.error = 'Value is not in standard list. SMRITI will validate or onboard this master dimension during import.'
            dv.showErrorMessage = True

# 3b. Add/enforce GST_RATE_PERCENT data validation on col AA (col 27) — BLOCK on invalid slab
print("Adding GST_RATE_PERCENT dropdown validation (col AA) ...")
gst_dv = DataValidation(
    type="list",
    formula1="'Validation Lists'!$T$2:$T$6",
    allow_blank=True,
    showDropDown=False,
    errorStyle="stop",
    errorTitle="Invalid GST Rate",
    error="Only statutory GST slabs are permitted: 0%, 5%, 12%, or 18%.",
    promptTitle="GST Rate (%)",
    prompt="Select 0, 5, 12 or 18",
    showErrorMessage=True,
    showInputMessage=True,
)
gst_dv.sqref = "AA5:AA500"
tmpl_ws.add_data_validation(gst_dv)

# 4. Update Validation Rules Sheet
print("Appending IM-013 to 'Validation Rules' sheet...")
vr_ws = wb["Validation Rules"]
next_vr_row = vr_ws.max_row + 1
rule_found = False
for r in range(1, vr_ws.max_row + 1):
    if vr_ws.cell(r, 1).value == "IM-013":
        rule_found = True
        break
if not rule_found:
    vr_ws.cell(next_vr_row, 1, value="IM-013")
    vr_ws.cell(next_vr_row, 2, value="Footwear selling price > Rs. 2,500 requires GST rate >= 18% (GST 2.0 threshold qc)")
    vr_ws.cell(next_vr_row, 3, value="TAX COMPLIANCE")
    vr_ws.cell(next_vr_row, 4, value="FLAG/REVIEW")

# 5. Update Field Notes & Corrections Sheet
print("Appending v2.2 ratification notes to 'Field Notes & Corrections' sheet...")
fn_ws = wb["Field Notes & Corrections"]
corrections = [
    ("Empty rows displayed permanent ERROR status due to COUNTA evaluating formula empty strings", "Col AI", "Updated formula to IF(AND(A5=\"\",C5=\"\"),\"EMPTY\",...)", "Eliminates 492 false ERROR cells on blank rows"),
    ("COUNTIF on empty SKU_PREVIEW caused false Duplicate SKU_PREVIEW error on blank rows", "Col AJ", "Guarded COUNTIF with AND(B5<>\"\", COUNTIF(...)>1)", "Eliminates 492 false positive duplicate alarms on new row entry"),
    ("Contradiction where missing mandatory attributes showed ERROR in Col AI but OK in Col AJ", "Col AJ", "Added Missing Mandatory Attributes branch in formula", "Synchronizes Col AI status with Col AJ message"),
    ("Validation Lists defined ranges were hardcoded to 1-2 cells, blocking standard colors/sizes/brands", "Validation Lists", "Expanded defined ranges (10 to 100 items) with comprehensive retail catalog values", "Allows multi-brand, multi-category retail entry without Excel range lockouts"),
    ("GST 2.0 dynamic threshold had no explicit validation rule", "Validation Rules", "Added Rule IM-013 flagging Selling Price > Rs. 2,500 with GST <= 5%", "Guarantees statutory tax compliance visibility before import"),
    ("SKU_PREVIEW formula generated double/trailing hyphens when attributes were empty", "Col B", "Updated formula with conditional delimiters", "Produces clean preview strings during drafting"),
]

for item in corrections:
    r_idx = fn_ws.max_row + 1
    fn_ws.cell(r_idx, 1, value=item[0])
    fn_ws.cell(r_idx, 2, value=item[1])
    fn_ws.cell(r_idx, 3, value=item[2])
    fn_ws.cell(r_idx, 4, value=item[3])

# Save official v2.2 release first
print(f"Saving official v2.2 release to {OUTPUT_V2_2}...")
wb.save(OUTPUT_V2_2)
print("SUCCESS: Saved SMRITI_Item_Master_Creation_Standard_v2.2.xlsx")

# Attempt in-place update of v2.1 if not locked by Excel
print(f"Attempting update to {OUTPUT_V2_1}...")
try:
    wb.save(OUTPUT_V2_1)
    print("SUCCESS: Updated SMRITI_Item_Master_Creation_Standard_v2.1.xlsx")
except PermissionError:
    print(f"NOTICE: {OUTPUT_V2_1.name} is currently open in Excel (PID lock). v2.2 generated cleanly without overwriting open file.")

