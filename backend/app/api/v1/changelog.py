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
