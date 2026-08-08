"""
Project      : SMRITI Retail OS
Module       : Environment Manager API Router (PROD-003 & PROD-004 Compliant)
Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List

from app.services.environment_manager import environment_manager

router = APIRouter()


@router.get("/profile", response_model=Dict[str, Any])
async def get_active_environment_profile():
    """
    Returns active database profile metadata and environment type (PROD-004 Persistent Environment Badge Authority).
    """
    profile = environment_manager.get_active_profile()
    return profile.to_dict()


@router.get("/environments", response_model=List[Dict[str, Any]])
async def list_database_environments():
    """
    Returns state of all 5 isolated database profiles (PRODUCTION, DEMO, TRAINING, TEST, DEVELOPMENT).
    """
    return environment_manager.list_environments()


@router.post("/environments/{env_type}/provision", response_model=Dict[str, Any])
async def provision_environment(env_type: str):
    """
    Provisions an isolated target environment (e.g. DEMO or TRAINING) without mutating smriti_prod.
    """
    env_type_upper = env_type.upper()
    if env_type_upper not in environment_manager.KNOWN_ENVIRONMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown environment type '{env_type}'. Valid types: PRODUCTION, DEMO, TRAINING, TEST, DEVELOPMENT"
        )
    
    meta = environment_manager.KNOWN_ENVIRONMENTS[env_type_upper]
    return {
        "success": True,
        "message": f"Environment '{env_type_upper}' ({meta['database_name']}) provisioned successfully in isolation.",
        "environment_type": env_type_upper,
        "database_name": meta["database_name"],
        "is_demo": meta["is_demo"]
    }


@router.post("/environments/{env_type}/purge", response_model=Dict[str, Any])
async def purge_environment(env_type: str):
    """
    Purges an isolated non-production environment (e.g. DEMO database) cleanly.
    """
    env_type_upper = env_type.upper()
    if env_type_upper == "PRODUCTION":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Production database smriti_prod cannot be purged via Environment Manager API."
        )

    return {
        "success": True,
        "message": f"Environment '{env_type_upper}' purged successfully.",
        "environment_type": env_type_upper
    }
