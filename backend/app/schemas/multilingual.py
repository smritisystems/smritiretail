"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.12.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance Core Layer (ICCL) - Multilingual / Vernacular Product Label Schema

Supports 8 of 22 constitutionally recognized Indian languages for product labels.
Used for:
- Retail shelf labels in regional languages
- POS billing receipts in local language
- Product catalogues for Tier-2/3 market distributors
- E-Commerce listing compliance (ONDC vernacular support)

Language codes follow ISO 639-1 standard.
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MultilingualLabel(BaseModel):
    """
    Vernacular product name and description in Indian regional languages.
    All fields are optional - populate only the languages relevant to the market.
    """

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "hi": "कपास की साड़ी",
                "ta": "பருத்தி புடவை",
                "te": "పత్తి చీర",
                "kn": "ಹತ್ತಿ ಸೀರೆ",
                "bn": "সুতির শাড়ি",
                "mr": "कापसाची साडी",
                "gu": "કપાસની સાડી",
                "pa": "ਸੂਤੀ ਸਾੜ੍ਹੀ",
            }
        },
    )

    hi: Optional[str] = Field(None, description="Hindi (हिन्दी) — Official national language")
    ta: Optional[str] = Field(None, description="Tamil (தமிழ்) — Tamil Nadu, Puducherry")
    te: Optional[str] = Field(None, description="Telugu (తెలుగు) — Andhra Pradesh, Telangana")
    kn: Optional[str] = Field(None, description="Kannada (ಕನ್ನಡ) — Karnataka")
    bn: Optional[str] = Field(None, description="Bengali (বাংলা) — West Bengal, Assam")
    mr: Optional[str] = Field(None, description="Marathi (मराठी) — Maharashtra")
    gu: Optional[str] = Field(None, description="Gujarati (ગુજરાતી) — Gujarat")
    pa: Optional[str] = Field(None, description="Punjabi (ਪੰਜਾਬੀ) — Punjab")

    def get_label_for_locale(self, locale_code: str, fallback: Optional[str] = None) -> Optional[str]:
        """
        Get the label for a given locale code.

        Args:
            locale_code: ISO 639-1 language code (e.g., 'hi', 'ta')
            fallback: Fallback value if the locale is not set

        Returns:
            Label string for the locale, or fallback if not available
        """
        value = getattr(self, locale_code.lower(), None)
        return value if value is not None else fallback

    def available_locales(self) -> list[str]:
        """Return a list of locale codes that have non-null values."""
        return [
            lang for lang in ("hi", "ta", "te", "kn", "bn", "mr", "gu", "pa")
            if getattr(self, lang) is not None
        ]

    def is_empty(self) -> bool:
        """Return True if no language labels are set."""
        return len(self.available_locales()) == 0


class ProductVernacularExtension(BaseModel):
    """
    Extension schema for embedding vernacular names into product records.
    This is a mixin-style schema for use as an optional field in product schemas.
    """

    model_config = ConfigDict(populate_by_name=True)

    vernacular_name: Optional[MultilingualLabel] = Field(
        None,
        description="Product name in Indian regional languages for local market labels",
    )
    vernacular_description: Optional[MultilingualLabel] = Field(
        None,
        description="Product description in Indian regional languages",
    )
    vernacular_unit: Optional[MultilingualLabel] = Field(
        None,
        description="Unit of measure label in regional languages (e.g., 'किलो' for kg in Hindi)",
    )
