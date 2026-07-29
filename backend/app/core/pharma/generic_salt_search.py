"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 24.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Generic Salt Composition & Substitute Finder Engine
"""

from typing import Dict, Any, List


class GenericSaltSearchEngine:
    """Active Generic Salt Indexer & Medicine Substitute Search Engine."""

    _CATALOG = [
        {"trade_name": "Calpol 500mg", "salt_name": "PARACETAMOL", "strength": "500mg", "mrp": 25.0, "manufacturer": "GSK"},
        {"trade_name": "Dolo 650mg", "salt_name": "PARACETAMOL", "strength": "650mg", "mrp": 30.0, "manufacturer": "Micro Labs"},
        {"trade_name": "Crocin 500mg", "salt_name": "PARACETAMOL", "strength": "500mg", "mrp": 24.0, "manufacturer": "GlaxoSmithKline"},
        {"trade_name": "Augmentin 625mg", "salt_name": "AMOXICILLIN_CLAVULANATE", "strength": "625mg", "mrp": 200.0, "manufacturer": "GSK"},
        {"trade_name": "Moxikind-CV 625", "salt_name": "AMOXICILLIN_CLAVULANATE", "strength": "625mg", "mrp": 170.0, "manufacturer": "Mankind"}
    ]

    @classmethod
    def search_substitutes(cls, active_salt: str) -> Dict[str, Any]:
        salt_query = active_salt.upper().strip()
        matches = [m for m in cls._CATALOG if m["salt_name"] == salt_query]

        return {
            "active_salt_name": salt_query,
            "matches_found": len(matches),
            "substitutes": matches
        }
