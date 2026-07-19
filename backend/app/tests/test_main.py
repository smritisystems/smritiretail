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
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from fastapi.testclient import TestClient
from ..main import app

client = TestClient(app)

def test_liveness():
    response = client.get("/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}

def test_readiness():
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}

def test_version():
    response = client.get("/version")
    assert response.status_code == 200
    assert "version" in response.json()
    assert "edition" in response.json()

def test_metadata_api():
    response = client.get("/api/v1/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert "productName" in data["app"]
    assert "edition" in data["app"]

def test_changelog_api():
    response = client.get("/api/v1/changelog")
    assert response.status_code == 200
    assert "Changelog" in response.text or "changelog" in response.text.lower()

def test_dev_tracker_api():
    response = client.get("/api/v1/dev-tracker")
    assert response.status_code == 200
    assert "warning" in response.headers
    assert "deprecated" in response.headers["warning"].lower()
    data = response.json()
    assert "gitInfo" in data
    assert "releaseScores" in data
    assert "modules" in data
    assert len(data["modules"]) > 0
