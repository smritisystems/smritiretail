import asyncio
import sys
sys.path.insert(0, "backend")

from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.schemas.product_resolution import TransactionLineItemInput
from app.services.product_resolution_service import ProductResolutionService
from app.services.canonical_transaction_writer import CanonicalTransactionWriter
from app.services.pricing_engine import PricingEngine

async def main():
    db_url = settings.DATABASE_URL.replace("smritisys", "smriti001")
    engine = create_async_engine(db_url)
    async_sess = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_sess() as session:
        session.info["company_id"] = "COMP-001"
        line_res = await ProductResolutionService.validate_line(
            session=session,
            company_id="COMP-001",
            line=TransactionLineItemInput(
                line_no=1,
                product_id=None,
                variant_id=None,
                item_id=None,
                code="CH-03-A-ROSEGOLD-41",
                sku="CH-03-A-ROSEGOLD-41",
                barcode="CH-03-A-ROSEGOLD-41",
                quantity=1,
                is_fee_line=False,
            ),
            allow_inactive=False,
        )
        print("line_res:", line_res)
        identity = await CanonicalTransactionWriter.resolve_dual_key_for_line(
            session=session,
            company_id="COMP-001",
            variant_id=line_res.variant_id,
            item_id=line_res.item_id,
            product_id=line_res.product_id,
            code_or_barcode="CH-03-A-ROSEGOLD-41",
            is_fee_line=False,
        )
        print("identity:", identity)
        price_info = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=identity.canonical_item_id or identity.legacy_product_id,
            variant_id=identity.canonical_variant_id,
            quantity=1,
            company_id="COMP-001",
        )
        print("price_info:", price_info)

asyncio.run(main())
