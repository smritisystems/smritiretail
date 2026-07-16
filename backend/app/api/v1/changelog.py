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

* Version    : 3.14.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pathlib import Path

router = APIRouter()

@router.get("/changelog", response_class=PlainTextResponse, tags=["Changelog"])
async def get_changelog():
    """
    Serve standard CHANGELOG.md file content from workspace root directory.
    """
    root_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
    changelog_path = root_dir / "CHANGELOG.md"
    
    if not changelog_path.exists():
        # Fallback 1: check in /app/
        changelog_path = Path("/app/CHANGELOG.md")
        
    if not changelog_path.exists():
        # Fallback 2: check in current working directory
        changelog_path = Path("CHANGELOG.md").resolve()
        
    if not changelog_path.exists():
        raise HTTPException(status_code=404, detail="Changelog file not found")
        
    try:
        with open(changelog_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read changelog: {e}")
