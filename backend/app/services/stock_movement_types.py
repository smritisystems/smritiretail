"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Single Source of Truth for Stock Movement Vocabulary
"""

from typing import Set

INFLOW_MOVEMENT_TYPES: Set[str] = {
    "IN",
    "INWARD",
    "INWARD_PURCHASE",
    "INWARD_GRN",
    "PURCHASE_RECEIPT",
    "GRN",
    "RETURN_INWARD",
    "SALES_RETURN",
    "ADJUSTMENT_IN",
    "TRANSFER_IN",
    "INWARD_SURPLUS",
    "OPENING_STOCK",
    "INWARD_INITIAL",
    "SALES_CANCEL",
    "PURCHASE",
    "RETURN",
}

OUTFLOW_MOVEMENT_TYPES: Set[str] = {
    "OUT",
    "OUTWARD",
    "OUTWARD_SALE",
    "SALE",
    "ADJUSTMENT_OUT",
    "TRANSFER_OUT",
    "RETURN_OUTWARD",
    "PURCHASE_RETURN",
    "OUTWARD_LOSS",
    "OUTWARD_DISPATCH",
    "POS_SALE",
    "OUTWARD_ECOM",
    "DISPATCH",
    "DAMAGE",
    "WRITE_OFF",
}

SIGNED_MOVEMENT_TYPES: Set[str] = {
    "ADJUSTMENT",
    "STOCK_ADJUSTMENT",
    "TRANSFER",
    "STOCK_TRANSFER",
}

ALL_MOVEMENT_TYPES: Set[str] = INFLOW_MOVEMENT_TYPES | OUTFLOW_MOVEMENT_TYPES | SIGNED_MOVEMENT_TYPES


def is_valid_movement_type(movement_type: str) -> bool:
    if not movement_type:
        return False
    return movement_type.upper() in ALL_MOVEMENT_TYPES
