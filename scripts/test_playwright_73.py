"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
from playwright.async_api import async_playwright
from pypdf import PdfReader

async def main():
    with open(r"exports\test_73_updated.html", "r", encoding="utf-8") as f:
        html = f.read()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")
        pdf_path = r"exports\test_73_updated.pdf"
        await page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
        )
        await browser.close()

    print(f"Generated {pdf_path}")
    reader = PdfReader(pdf_path)
    print(f"Total Pages: {len(reader.pages)}")
    for i, page in enumerate(reader.pages):
        print(f"=== PAGE {i+1} ===")
        text = page.extract_text()
        print(text[:400])

if __name__ == "__main__":
    asyncio.run(main())
