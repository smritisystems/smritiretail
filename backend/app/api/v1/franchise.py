"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 21.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Franchise & Royalty REST API Gateway
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Body

from app.core.franchise.franchise_manager import FranchiseManager
from app.core.franchise.royalty_calculator import RoyaltyCalculator
from app.core.franchise.settlement_engine import SettlementEngine

router = APIRouter(prefix="/franchise", tags=["Domain Release: Multi-Store Franchise & Royalty Engine (v21.0.0)"])


@router.post("/stores")
async def register_franchise_store(store_code: str = Body(...), store_name: str = Body(...), store_type: str = Body("FOFO"), royalty_pct: float = Body(5.0), tech_fee: float = Body(250.0)):
    """Registers a new franchise store (COCO or FOFO)."""
    rec = FranchiseManager.register_store(store_code, store_name, store_type, royalty_pct, tech_fee)
    return rec.to_dict()


@router.get("/stores")
async def list_franchise_stores():
    """Lists registered franchise stores."""
    return FranchiseManager.list_stores()


@router.post("/royalty/calculate")
async def calculate_royalty_fee(store_code: str = Body(...), gross_sales: float = Body(...), royalty_pct: float = Body(5.0), tech_fee: float = Body(250.0)):
    """Calculates franchise royalty fee and tech platform dues."""
    return RoyaltyCalculator.calculate_royalty(store_code, gross_sales, royalty_pct, tech_fee)


@router.post("/settlement/note")
async def create_settlement_note(from_store: str = Body(...), to_store: str = Body(...), amount: float = Body(...), description: str = Body(...)):
    """Generates inter-store settlement clearing note."""
    return SettlementEngine.generate_intercompany_note(from_store, to_store, amount, description)
