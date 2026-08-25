import asyncio
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, r"F:\SMRITRretailNX\backend")

from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext
from app.services.reports import ReportsService

async def main():
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as db:
        tenant = TenantContext(company_id="COMP-001", branch_id="MAIN")
        svc = ReportsService(db, tenant)
        excel_bytes = await svc.export_tax_invoices_master_excel(bill_from=18, bill_to=137)
        
        target_files = [
            "Tax_Invoices_Full_Details_TT_18_to_137.xlsx",
            "Tax_Invoices_TT_18_to_137_Article_Color_Size_Split.xlsx",
            "Tax_Invoices_TT_18_to_137_Including_Cancelled.xlsx",
            "Tax_Invoices_TT_18_to_137_Updated_Bill136.xlsx"
        ]
        
        for tf in target_files:
            try:
                with open(tf, "wb") as f:
                    f.write(excel_bytes)
                print(f"Saved updated Excel report: {tf} ({len(excel_bytes)} bytes)")
            except PermissionError:
                print(f"Notice: {tf} is currently open in Excel. Saved updated copy to Tax_Invoices_TT_18_to_137_Updated_Bill136.xlsx instead.")

if __name__ == "__main__":
    asyncio.run(main())
