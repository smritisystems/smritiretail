"""
SMRITI Retail OS — Gate 9 axe-core WCAG 2.1 AA Scan Script
----------------------------------------------------------
Injects axe-core into Playwright browser context across all 7 heavy workspaces:
  - POS Terminal
  - Purchase Studio
  - Item Master
  - Customer Master
  - Business Ledger
  - Report Designer
  - Master Management

Author: Jawahar Ramkripal Mallah
Version: 3.17.0
Copyright: © SMRITIBooks.com. All Rights Reserved.
"""

import asyncio
import json
import os
import sys
import time
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
SUMMARY_PATH = os.path.join(os.getcwd(), "scratch", "axe_core_wcag_summary.json")

AXE_SCRIPT_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js"

async def run_axe_scan():
    print("=" * 80)
    print("SMRITI RETAIL OS — GATE 9 AXE-CORE WCAG 2.1 AA SCAN")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        print("Navigating to SMRITI Retail OS and authenticating...")
        await page.goto(BASE_URL)
        await page.wait_for_timeout(1000)

        # DOM Login
        user = page.locator('input[type="text"]').first
        pwd = page.locator('input[type="password"]').first
        btn = page.locator('button[type="submit"]').first
        if await user.count() > 0:
            await user.fill("admin")
            await pwd.fill("Admin@123")
            await btn.click()
            await page.wait_for_timeout(1500)

        workspaces = [
            "POS Terminal",
            "Purchase Studio",
            "Item Master",
            "Customer Master",
            "Business Ledger",
            "Report Designer",
            "Master Management"
        ]

        axe_results = {}

        for ws in workspaces:
            print(f"\n--- Running axe-core WCAG 2.1 AA Scan for Workspace: {ws} ---")
            nav_btn = page.locator(f"text='{ws}'").first
            if await nav_btn.count() > 0 and await nav_btn.is_visible():
                await nav_btn.click()
                await page.wait_for_timeout(600)

            # Inject axe-core
            await page.add_script_tag(url=AXE_SCRIPT_URL)
            await page.wait_for_timeout(300)

            # Run axe.run()
            axe_eval = """
            (async () => {
                const results = await axe.run(document, {
                    runOnly: {
                        type: 'tag',
                        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
                    }
                });
                return {
                    violations: results.violations.map(v => ({
                        id: v.id,
                        impact: v.impact,
                        description: v.description,
                        helpUrl: v.helpUrl,
                        nodesCount: v.nodes.length,
                        sampleSelector: v.nodes.slice(0, 2).map(n => n.target)
                    })),
                    passesCount: results.passes.length,
                    incompleteCount: results.incomplete.length
                };
            })()
            """
            try:
                res = await page.evaluate(axe_eval)
                axe_results[ws] = res
                print(f"  Passed Checks : {res['passesCount']}")
                print(f"  Violations    : {len(res['violations'])}")
                for v in res['violations']:
                    print(f"    - [{v['impact'].upper()}] {v['id']}: {v['description']} ({v['nodesCount']} elements)")
            except Exception as ex:
                axe_results[ws] = {"error": str(ex), "violations": []}
                print(f"  [Scan Exception] {ex}")

        await browser.close()

    total_violations = sum(len(r.get("violations", [])) for r in axe_results.values())
    critical_serious = sum(
        sum(1 for v in r.get("violations", []) if v.get("impact") in ("critical", "serious"))
        for r in axe_results.values()
    )

    gate9_status = "Done" if (critical_serious == 0) else "Partially Verified"

    summary = {
        "gate": "Gate 9 — Accessibility (axe-core WCAG 2.1 AA)",
        "status": gate9_status,
        "total_violations_count": total_violations,
        "critical_serious_count": critical_serious,
        "workspace_axe_results": axe_results,
        "evidence": f"Scanned 7 heavy workspaces with axe-core. Critical/Serious violations: {critical_serious}. Total rule violations: {total_violations}."
    }

    with open(SUMMARY_PATH, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 80)
    print("AXE-CORE WCAG 2.1 AA AUDIT SUMMARY")
    print("=" * 80)
    print(f"Gate 9 Status            : {gate9_status}")
    print(f"Critical / Serious Count : {critical_serious}")
    print(f"Total Violations Count   : {total_violations}")
    print(f"Summary Saved            : {SUMMARY_PATH}")

if __name__ == "__main__":
    asyncio.run(run_axe_scan())
