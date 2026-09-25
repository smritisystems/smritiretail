"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Partner Stock Visibility & Identifier Resolution
"""

from typing import Optional, Dict, Any
from dataclasses import dataclass
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.customer_article_mapping import CustomerArticleMapping
from ..models.ecom import EcomSkuMapping
from ..models.identity_registry import SmritiIdentityAlias
from ..models.item_master import ItemBarcode, ItemVariant
from ..models.inventory import Product


@dataclass
class PartnerResolutionResult:
    found: bool
    product_id: Optional[str] = None
    item_id: Optional[str] = None
    variant_id: Optional[str] = None
    resolution_tier: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class PartnerIdentifierResolver:
    """
    Decoupled Partner Identifier Resolver for Partner Stock Visibility (PSV)
    and external EDI/Retailer feeds.
    
    Resolves third-party vendor/buyer SKUs and barcodes to canonical SMRITI
    catalog entities (products.id, items.id, item_variants.id).
    """

    @classmethod
    async def resolve(
        cls,
        session: AsyncSession,
        company_id: str,
        external_sku: str,
        external_barcode: Optional[str] = None,
        party_id: Optional[str] = None,
    ) -> PartnerResolutionResult:
        if not external_sku or not str(external_sku).strip():
            return PartnerResolutionResult(found=False)

        q_sku = str(external_sku).strip()
        q_bc = str(external_barcode).strip() if external_barcode else None

        # ---------------------------------------------------------------------
        # Tier 1: Customer / Buyer Article Code (customer_article_mappings)
        # ---------------------------------------------------------------------
        cam_stmt = select(CustomerArticleMapping).where(
            CustomerArticleMapping.company_id == company_id,
            CustomerArticleMapping.is_active == True,
            CustomerArticleMapping.is_deleted == False,
            or_(
                CustomerArticleMapping.customer_article == q_sku,
                CustomerArticleMapping.barcode == (q_bc or q_sku),
            )
        )
        cam = (await session.execute(cam_stmt)).scalars().first()
        if cam:
            # Check if there is an associated legacy Product record
            prod_id = None
            if cam.variant_id:
                p_stmt = select(Product.id).where(
                    Product.company_id == company_id,
                    Product.item_variant_id == cam.variant_id,
                    Product.is_deleted == False,
                ).limit(1)
                prod_id = (await session.execute(p_stmt)).scalar_one_or_none()

            return PartnerResolutionResult(
                found=True,
                product_id=prod_id,
                item_id=cam.item_id,
                variant_id=cam.variant_id,
                resolution_tier="TIER_1_CUSTOMER_ARTICLE_MAPPING",
                metadata={"customer_id": cam.customer_id, "vendor_article": cam.vendor_article},
            )

        # ---------------------------------------------------------------------
        # Tier 2: eCommerce Channel SKU Mappings (ecom_sku_mappings)
        # ---------------------------------------------------------------------
        try:
            ecom_stmt = select(EcomSkuMapping).where(
                EcomSkuMapping.company_id == company_id,
                EcomSkuMapping.external_sku == q_sku,
                EcomSkuMapping.is_active == True,
                EcomSkuMapping.is_deleted == False,
            )
            ecom = (await session.execute(ecom_stmt)).scalars().first()
            if ecom:
                prod_id = None
                if ecom.variant_id:
                    p_stmt = select(Product.id).where(
                        Product.company_id == company_id,
                        Product.item_variant_id == ecom.variant_id,
                        Product.is_deleted == False,
                    ).limit(1)
                    prod_id = (await session.execute(p_stmt)).scalar_one_or_none()

                channel = getattr(ecom, "channel_code", None) or getattr(ecom, "channel_name", None)
                return PartnerResolutionResult(
                    found=True,
                    product_id=prod_id,
                    item_id=ecom.item_id,
                    variant_id=ecom.variant_id,
                    resolution_tier="TIER_2_ECOM_SKU_MAPPING",
                    metadata={"channel_code": channel, "channel_name": channel},
                )
        except Exception:
            pass

        # ---------------------------------------------------------------------
        # Tier 3: External / Partner Identity Aliases (smriti_identity_alias)
        # ---------------------------------------------------------------------
        alias_stmt = select(SmritiIdentityAlias).where(
            SmritiIdentityAlias.company_id == company_id,
            SmritiIdentityAlias.alias_code == q_sku,
            SmritiIdentityAlias.is_active == True,
            SmritiIdentityAlias.is_deleted == False,
        )
        alias = (await session.execute(alias_stmt)).scalars().first()
        if alias:
            return PartnerResolutionResult(
                found=True,
                product_id=alias.entity_id if alias.entity_type == "PRODUCT" else None,
                item_id=alias.entity_id if alias.entity_type == "ITEM" else None,
                variant_id=alias.entity_id if alias.entity_type == "VARIANT" else None,
                resolution_tier="TIER_3_IDENTITY_ALIAS",
                metadata={"alias_type": alias.alias_type, "source_system": alias.source_system},
            )

        # ---------------------------------------------------------------------
        # Tier 4: Optical Barcode Match (item_barcodes)
        # ---------------------------------------------------------------------
        bc_query = q_bc or q_sku
        bc_stmt = select(ItemBarcode).where(
            ItemBarcode.company_id == company_id,
            ItemBarcode.barcode == bc_query,
            ItemBarcode.is_deleted == False,
        )
        bc_match = (await session.execute(bc_stmt)).scalars().first()
        if bc_match:
            prod_id = None
            if bc_match.variant_id:
                p_stmt = select(Product.id).where(
                    Product.company_id == company_id,
                    Product.item_variant_id == bc_match.variant_id,
                    Product.is_deleted == False,
                ).limit(1)
                prod_id = (await session.execute(p_stmt)).scalar_one_or_none()

            return PartnerResolutionResult(
                found=True,
                product_id=prod_id,
                item_id=bc_match.item_id,
                variant_id=bc_match.variant_id,
                resolution_tier="TIER_4_ITEM_BARCODE",
                metadata={"barcode_type": bc_match.barcode_type},
            )

        # ---------------------------------------------------------------------
        # Tier 4B: Variant SKU & Item Code Match (item_variants / items)
        # ---------------------------------------------------------------------
        var_stmt = select(ItemVariant).where(
            ItemVariant.company_id == company_id,
            ItemVariant.variant_sku == q_sku,
            ItemVariant.is_deleted == False,
        )
        var_match = (await session.execute(var_stmt)).scalars().first()
        if var_match:
            prod_id = None
            p_stmt = select(Product.id).where(
                Product.company_id == company_id,
                Product.item_variant_id == var_match.id,
                Product.is_deleted == False,
            ).limit(1)
            prod_id = (await session.execute(p_stmt)).scalar_one_or_none()

            return PartnerResolutionResult(
                found=True,
                product_id=prod_id,
                item_id=var_match.item_id,
                variant_id=var_match.id,
                resolution_tier="TIER_4B_VARIANT_SKU",
                metadata={"variant_name": var_match.variant_name},
            )

        # ---------------------------------------------------------------------
        # Tier 5: Direct Product Master Fallback (products)
        # ---------------------------------------------------------------------
        p_stmt = select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted == False,
            or_(
                Product.sku == q_sku,
                Product.code == q_sku,
                Product.barcode == (q_bc or q_sku),
            )
        )
        prod = (await session.execute(p_stmt)).scalars().first()
        if prod:
            return PartnerResolutionResult(
                found=True,
                product_id=prod.id,
                item_id=prod.item_id,
                variant_id=prod.item_variant_id,
                resolution_tier="TIER_5_DIRECT_PRODUCT_CATALOG",
                metadata={"product_name": prod.name},
            )

        # ---------------------------------------------------------------------
        # Unresolved: Partner SKU is not yet mapped to internal catalog
        # ---------------------------------------------------------------------
        return PartnerResolutionResult(found=False)
