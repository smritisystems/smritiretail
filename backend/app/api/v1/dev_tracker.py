"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from fastapi import APIRouter, HTTPException, Response
from typing import Dict, Any
from ...dev_tracker.scanner import scan_codebase
from ...dev_tracker.reports import write_reports

router = APIRouter()

# In-memory scan results caching
cached_results: Dict[str, Any] = {}

@router.get("/dev-tracker", tags=["Development Intelligence"])
async def get_dev_tracker_status(response: Response):
    """
    Get latest cached codebase development diagnostics scan results.
    """
    response.headers["Warning"] = '299 - "SMRITI SDIC is deprecated and will be removed in v4.0"'
    global cached_results
    if not cached_results:
        try:
            results = scan_codebase()
            write_reports(results)
            cached_results = results
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Codebase initial scan failed: {e}")
            
    return cached_results

@router.post("/dev-tracker/scan", tags=["Development Intelligence"])
async def trigger_dev_tracker_scan(response: Response):
    """
    Trigger on-demand codebase static scan, rewrite reports, and reload memory cache.
    """
    response.headers["Warning"] = '299 - "SMRITI SDIC is deprecated and will be removed in v4.0"'
    global cached_results
    try:
        results = scan_codebase()
        write_reports(results)
        cached_results = results
        return cached_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Codebase static scan failed: {e}")
