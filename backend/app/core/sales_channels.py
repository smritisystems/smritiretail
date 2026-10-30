"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.87.0
Created      : 2026-10-16
Modified     : 2026-10-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, Optional

# Canonical SMRITI Sales Channels
MODERN_TRADE = "MODERN_TRADE"
GENERAL_TRADE = "GENERAL_TRADE"
B2B_WHOLESALE = "B2B_WHOLESALE"
POS_RETAIL = "POS_RETAIL"
ECOMMERCE = "ECOMMERCE"

ALL_SALES_CHANNELS = [
    MODERN_TRADE,
    GENERAL_TRADE,
    B2B_WHOLESALE,
    POS_RETAIL,
    ECOMMERCE,
]

DEFAULT_CHANNEL_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    MODERN_TRADE: {
        "channel": MODERN_TRADE,
        "label": "Modern Trade (LFR / SIS)",
        "requires_store_location": True,
        "description": "Large Format Retail, Shop-in-Shop, and Key Accounts requiring store-level destination tracking and PSV shadow projection.",
    },
    GENERAL_TRADE: {
        "channel": GENERAL_TRADE,
        "label": "General Trade",
        "requires_store_location": False,
        "description": "Traditional trade, distributor, and wholesale channel billing without mandatory store-level destination.",
    },
    B2B_WHOLESALE: {
        "channel": B2B_WHOLESALE,
        "label": "B2B Wholesale",
        "requires_store_location": False,
        "description": "Corporate institutional supply and direct merchant billing.",
    },
    POS_RETAIL: {
        "channel": POS_RETAIL,
        "label": "POS Retail",
        "requires_store_location": False,
        "description": "Over-the-counter retail direct consumer transactions.",
    },
    ECOMMERCE: {
        "channel": ECOMMERCE,
        "label": "E-Commerce",
        "requires_store_location": False,
        "description": "Digital marketplaces and direct-to-consumer online order fulfillment.",
    },
}


def get_channel_capabilities(channel: Optional[str]) -> Dict[str, Any]:
    """
    Returns the authoritative capability map for a given sales channel.
    Defaults to B2B_WHOLESALE capabilities if channel is unknown or empty.
    """
    if not channel:
        return DEFAULT_CHANNEL_CAPABILITIES[B2B_WHOLESALE].copy()
    
    clean_channel = channel.strip().upper()
    cap = DEFAULT_CHANNEL_CAPABILITIES.get(clean_channel)
    if cap:
        return cap.copy()
    
    # Fallback for dynamic or custom channels
    return {
        "channel": clean_channel,
        "label": clean_channel.replace("_", " ").title(),
        "requires_store_location": False,
        "description": f"Dynamic sales channel {clean_channel}",
    }


def channel_requires_store_location(channel: Optional[str]) -> bool:
    """
    Convenience predicate evaluating whether the sales channel requires store-level tracking.
    """
    caps = get_channel_capabilities(channel)
    return bool(caps.get("requires_store_location", False))
