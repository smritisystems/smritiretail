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

import os
from pathlib import Path
from typing import Dict, Any

def draw_progress_bar(percentage: int) -> str:
    filled = int(percentage / 10)
    empty = 10 - filled
    return "█" * filled + "░" * empty + f" {percentage}%"

def write_reports(res: Dict[str, Any]) -> None:
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    
    # 1. Resolve date and paths
    import datetime
    date_str = datetime.date.today().isoformat()
    reports_dir = root_dir / "docs" / "reports" / date_str
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    history_file_path = root_dir / "docs" / "reports" / "history.json"
    
    # 2. Update history log
    history = []
    if history_file_path.exists():
        try:
            with open(history_file_path, "r", encoding="utf-8") as h_file:
                history = json.loads(h_file.read())
        except Exception:
            pass

    import json
    new_entry = {
        "timestamp": res["timestamp"],
        "dhi": res["releaseScores"]["dhi"],
        "developmentScore": res["releaseScores"]["developmentScore"],
        "qualityScore": res["releaseScores"]["qualityScore"],
        "releaseScore": res["releaseScores"]["releaseScore"],
        "securityScore": res["releaseScores"]["securityScore"],
        "testCoverage": res["releaseScores"]["testCoverage"],
        "documentation": res["releaseScores"]["documentation"]
    }
    
    # Add if no entry or time has progressed
    if not history or history[-1]["timestamp"] != new_entry["timestamp"]:
        history.append(new_entry)
        with open(history_file_path, "w", encoding="utf-8") as h_file:
            json.dump(history, h_file, indent=2)

    # 3. Generate DEVELOPMENT_STATUS.md
    dhi_bar = draw_progress_bar(res["releaseScores"]["dhi"])
    dev_bar = draw_progress_bar(res["releaseScores"]["developmentScore"])
    sec_bar = draw_progress_bar(res["releaseScores"]["securityScore"])
    
    md_dev_status = f"""# SMRITI Development Status Dashboard

*Generated: {res["timestamp"]}*
*Branch: {res["gitInfo"]["branch"]} | Last Commit: {res["gitInfo"]["lastCommitHash"]}*

## SMRITI Development Health Index (DHI)
```
DHI:      {dhi_bar} (Grade {res["releaseScores"]["grade"]})
Release:  {draw_progress_bar(res["releaseScores"]["releaseScore"])}
Security: {sec_bar}
```

## Discovered Modules Index

| Module | Category | Frontend | Backend | Database | API | Tests | Docs | Overall |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
"""
    for m in res["modules"]:
        frontend = "✅" if m["frontendComplete"] else ("⚠️" if m["frontendStarted"] else "❌")
        backend = "✅" if m["backendComplete"] else ("⚠️" if m["backendStarted"] else "❌")
        db = "✅" if m["databaseComplete"] else "❌"
        api = "✅" if m["apiComplete"] else "❌"
        tests = "✅" if m["unitTestsComplete"] else "❌"
        docs = "✅" if m["documentationComplete"] else "❌"
        md_dev_status += f"| {m['name']} | {m['category']} | {frontend} | {backend} | {db} | {api} | {tests} | {docs} | {m['overallPercentage']}% |\n"

    # Write root status sheet
    with open(root_dir / "DEVELOPMENT_STATUS.md", "w", encoding="utf-8") as f:
        f.write(md_dev_status)
        
    # Write timestamped copy
    with open(reports_dir / "DEVELOPMENT_STATUS.md", "w", encoding="utf-8") as f:
        f.write(md_dev_status)

    # 4. Generate and write remaining 14 files
    # MODULE_PROGRESS.md
    module_progress_md = f"# Module Progress Details\n\n*Generated: {res['timestamp']}*\n\n"
    module_progress_md += "| Module | Category | Progress | Risk Rating |\n| :--- | :--- | :---: | :---: |\n"
    for m in res["modules"]:
        module_progress_md += f"| {m['name']} | {m['category']} | {m['overallPercentage']}% | {m['riskRating']} |\n"

    # FEATURE_MATRIX.md
    feature_matrix_md = f"# SMRITI Feature Matrix\n\n*Generated: {res['timestamp']}*\n\n"
    feature_matrix_md += "| Module | UI Designed | Frontend | Backend | Business Logic | Validation | Security | Reports | Printing | Barcode |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n"
    for m in res["modules"]:
        ui = "✅" if m["uiDesigned"] else "❌"
        fe = "✅" if m["frontendComplete"] else "❌"
        be = "✅" if m["backendComplete"] else "❌"
        bl = "✅" if m["businessLogicComplete"] else "❌"
        val = "✅" if m["validationComplete"] else "❌"
        sec = "✅" if m["securityComplete"] else "❌"
        rep = "✅" if m["reportsComplete"] else "❌"
        prn = "✅" if m["printingComplete"] else "❌"
        bc = "✅" if m["barcodeComplete"] else "❌"
        feature_matrix_md += f"| {m['name']} | {ui} | {fe} | {be} | {bl} | {val} | {sec} | {rep} | {prn} | {bc} |\n"

    # UI_STATUS.md
    ui_status_md = f"# UI Status Sheet\n\n*Generated: {res['timestamp']}*\n\n"
    ui_status_md += "| Module | UI Designed | Frontend Started | Frontend Complete | Overall UI Score |\n| :--- | :---: | :---: | :---: | :---: |\n"
    for m in res["modules"]:
        ui = "✅" if m["uiDesigned"] else "❌"
        fes = "✅" if m["frontendStarted"] else "❌"
        fec = "✅" if m["frontendComplete"] else "❌"
        score = (100 if m["frontendComplete"] else (50 if m["frontendStarted"] else 0))
        ui_status_md += f"| {m['name']} | {ui} | {fes} | {fec} | {score}% |\n"

    # BACKEND_STATUS.md
    backend_status_md = f"# Backend Status Sheet\n\n*Generated: {res['timestamp']}*\n\n"
    backend_status_md += "| Module | Backend Started | Backend Complete | Business Logic | Validation |\n| :--- | :---: | :---: | :---: | :---: |\n"
    for m in res["modules"]:
        bes = "✅" if m["backendStarted"] else "❌"
        bec = "✅" if m["backendComplete"] else "❌"
        bl = "✅" if m["businessLogicComplete"] else "❌"
        val = "✅" if m["validationComplete"] else "❌"
        backend_status_md += f"| {m['name']} | {bes} | {bec} | {bl} | {val} |\n"

    # DATABASE_STATUS.md
    database_status_md = f"# Database Entities Registry\n\n*Generated: {res['timestamp']}*\n\n"
    database_status_md += "| Module | Database Setup | Checked Status |\n| :--- | :---: | :--- |\n"
    for m in res["modules"]:
        db = "✅" if m["databaseComplete"] else "❌"
        status = "Schema tables fully validated" if m["databaseComplete"] else "Missing or incomplete DB tables mapping"
        database_status_md += f"| {m['name']} | {db} | {status} |\n"

    # API_STATUS.md
    api_status_md = f"# API Endpoints Audit\n\n*Generated: {res['timestamp']}*\n\n"
    api_status_md += "| Module | API Routes Integrated | Status |\n| :--- | :---: | :--- |\n"
    for m in res["modules"]:
        api = "✅" if m["apiComplete"] else "❌"
        status = "Endpoints active and exposed" if m["apiComplete"] else "No active endpoint routes found"
        api_status_md += f"| {m['name']} | {api} | {status} |\n"

    # TEST_STATUS.md
    test_status_md = f"# Test Suite Status Sheet\n\n*Generated: {res['timestamp']}*\n\n"
    test_status_md += "| Module | Unit Tests Complete | Integration Tests Complete | Status |\n| :--- | :---: | :---: | :--- |\n"
    for m in res["modules"]:
        ut = "✅" if m["unitTestsComplete"] else "❌"
        it = "✅" if m["integrationTestsComplete"] else "❌"
        status = "Fully covered with assertions" if m["unitTestsComplete"] else "No test suite found"
        test_status_md += f"| {m['name']} | {ut} | {it} | {status} |\n"

    # DOCUMENTATION_STATUS.md
    documentation_status_md = f"# Documentation Status Sheet\n\n*Generated: {res['timestamp']}*\n\n"
    documentation_status_md += "| Module | Docs Present | Recommendation |\n| :--- | :---: | :--- |\n"
    for m in res["modules"]:
        doc = "✅" if m["documentationComplete"] else "❌"
        rec = m["recommendations"][0] if m["recommendations"] else "Documentation is up to date"
        documentation_status_md += f"| {m['name']} | {doc} | {rec} |\n"

    # SECURITY_STATUS.md
    security_status_md = f"# Security Compliance Status\n\n*Generated: {res['timestamp']}*\n\n"
    security_status_md += "| Module | Auth Complete | Authz Complete | Security Status |\n| :--- | :---: | :---: | :--- |\n"
    for m in res["modules"]:
        auth = "✅" if m["authenticationComplete"] else "❌"
        authz = "✅" if m["authorizationComplete"] else "❌"
        status = "Secure" if m["securityComplete"] else "Non-compliant / Public"
        security_status_md += f"| {m['name']} | {auth} | {authz} | {status} |\n"

    # TECHNICAL_DEBT.md
    technical_debt_md = f"# Technical Debt Analysis\n\n*Generated: {res['timestamp']}*\n\n"
    technical_debt_md += f"- **Code Quality Score:** {res['releaseScores']['qualityScore']}\n"
    technical_debt_md += "- **Large/Bloated Code Files:** "
    if 'codeHealth' in res and res['codeHealth'].get('largeComponents'):
        technical_debt_md += ", ".join(res['codeHealth']['largeComponents'])
    else:
        technical_debt_md += "None detected"
    technical_debt_md += "\n"

    # BUG_TRACKER.md
    bug_tracker_md = f"# Bug Tracker Log\n\n*Generated: {res['timestamp']}*\n\n"
    bug_tracker_md += "| Module | Risk Rating | Critical Issues / Recommendations |\n| :--- | :---: | :--- |\n"
    for m in res["modules"]:
        rec = ", ".join(m["recommendations"]) if m["recommendations"] else "No active recommendations"
        bug_tracker_md += f"| {m['name']} | {m['riskRating']} | {rec} |\n"

    # RELEASE_READINESS.md
    release_readiness_md = f"# Release Readiness Review\n\n*Generated: {res['timestamp']}*\n\n"
    release_readiness_md += "| Module | Production Ready | Missing Dependencies |\n| :--- | :---: | :--- |\n"
    for m in res["modules"]:
        pr = "✅ YES" if m["productionReady"] else "❌ NO"
        deps = ", ".join(m["missingDependencies"]) if m["missingDependencies"] else "None"
        release_readiness_md += f"| {m['name']} | {pr} | {deps} |\n"

    # CHANGE_HISTORY.md
    change_history_md = f"# Change History Log\n\n*Generated: {res['timestamp']}*\n\n"
    change_history_md += f"- **Current Active Branch:** `{res['gitInfo']['branch']}`\n"
    change_history_md += f"- **Last Commit Hash:** `{res['gitInfo']['lastCommitHash']}`\n"
    change_history_md += f"- **Last Commit Message:** \"{res['gitInfo']['lastCommitMessage']}\"\n"
    change_history_md += f"- **Last Commit Author:** {res['gitInfo']['lastCommitAuthor']} ({res['gitInfo']['lastCommitDate']})\n"

    reports_map = {
        "EXECUTIVE_SUMMARY.md": f"""# Executive Summary: SMRITI Development Intelligence Center
 
*Scan Timestamp: {res["timestamp"]}*
*Release Target: v{res["gitInfo"]["releaseVersion"]}*

## High-Level Engineering Indices
- **SMRITI Development Health Index (DHI):** {res["releaseScores"]["dhi"]}% (Grade {res["releaseScores"]["grade"]})
- **Quality Score:** {res["releaseScores"]["qualityScore"]}%
- **Security Score:** {res["releaseScores"]["securityScore"]}%
- **Release Readiness Score:** {res["releaseScores"]["releaseScore"]}%

## Active Gaps & Vulnerabilities
- **Critical Gaps:** {res["riskAnalysis"]["critical"]}
- **High Gaps:** {res["riskAnalysis"]["high"]}
- **Medium Gaps:** {res["riskAnalysis"]["medium"]}
- **Low Gaps:** {res["riskAnalysis"]["low"]}
""",
        "MODULE_PROGRESS.md": module_progress_md,
        "FEATURE_MATRIX.md": feature_matrix_md,
        "UI_STATUS.md": ui_status_md,
        "BACKEND_STATUS.md": backend_status_md,
        "DATABASE_STATUS.md": database_status_md,
        "API_STATUS.md": api_status_md,
        "TEST_STATUS.md": test_status_md,
        "DOCUMENTATION_STATUS.md": documentation_status_md,
        "SECURITY_STATUS.md": security_status_md,
        "TECHNICAL_DEBT.md": technical_debt_md,
        "BUG_TRACKER.md": bug_tracker_md,
        "RELEASE_READINESS.md": release_readiness_md,
        "CHANGE_HISTORY.md": change_history_md
    }

    for name, content in reports_map.items():
        with open(reports_dir / name, "w", encoding="utf-8") as f:
            f.write(content)

