import asyncio
import traceback
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.models.auth import User
from app.services.rebalancing_service import StockRebalancingService
from app.services.security import SecurityService
from app.services.identity_service import ProductIdentityService
from app.compliance.services.gst_recon_service import GSTReconciliationService
from app.tests.conftest import clear_db
from app.db.session import async_session


async def run():
    async with async_session() as db:
        try:
            print("Clear DB...")
            await clear_db(db)

            print("1. Rebalancing...")
            reb_svc = StockRebalancingService()
            recs = await reb_svc.calculate_rebalancing_recommendations(
                db=db,
                source_branch_id="br-headquarters",
                target_branch_id="br-downtown",
                min_threshold_qty=10,
            )
            print("Rebalancing OK:", recs)

            print("2. User & Scopes...")
            user = User(
                id="usr-reg-01",
                username="reg_user",
                email="reg@smriti.com",
                hashed_password="pwd",
                is_platform_admin=True,
            )
            db.add(user)
            await db.commit()
            sec_svc = SecurityService(db)
            scopes = await sec_svc.get_effective_permission_scopes(user.id)
            print("Scopes OK:", scopes)

            print("3. GST Recon...")
            gst_svc = GSTReconciliationService()
            reconciled = await gst_svc.reconcile_gstr2b(
                db=db,
                gstin="27AAAAA0000A1Z5",
                financial_period="072026",
                purchase_invoices=[{
                    "supplier_gstin": "27SUPP1Z1",
                    "invoice_number": "INV-REG-1",
                    "taxable_value": 1000.0,
                    "tax_amount": 180.0,
                }],
                gstr2b_invoices=[{
                    "supplier_gstin": "27SUPP1Z1",
                    "invoice_number": "INV-REG-1",
                    "taxable_value": 1000.0,
                    "tax_amount": 180.0,
                }],
            )
            print("Recon OK:", len(reconciled))

            print("4. Barcode...")
            pie_svc = ProductIdentityService()
            identity = await pie_svc.assign_gs1_barcode(
                db=db,
                product_id="prod-reg-01",
                sku_business_key="SKU-REG-SUITE-001",
                name="Regression Item",
                category="Test",
                brand="SMRITI",
            )
            print("Barcode OK:", identity.barcode)

            print("5. Variants...")
            variants = await pie_svc.generate_variant_skus(
                db=db,
                parent_product_id="prod-reg-01",
                parent_sku="SKU-REG-SUITE-001",
                variants=[{"size": "XL", "color": "Black"}],
            )
            print("Variants OK:", variants)

            print("6. Health Cutover API...")
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get("/api/v1/health/cutover")
                print("Status:", res.status_code)
                print("Body:", res.text)
                assert res.status_code == 200

            print("ALL PASSED CLEANLY!")
        except Exception as e:
            print("FAILED AT STEP:", e)
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
