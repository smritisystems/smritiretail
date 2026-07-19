"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 1.0.0
* Created    : 2026-07-11
* Modified   : 2026-07-19
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
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
