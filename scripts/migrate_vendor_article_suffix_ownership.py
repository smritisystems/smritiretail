import json
import sys
from pathlib import Path

import requests

WORKBOOK = Path(r"F:\SMRITRretailNX\exports\MASTER_CONSOLIDATED_ALL_60_INVOICES_TATTLY_THREADS.xlsx")
BASE_URL = "http://127.0.0.1:8000"


def main() -> None:
    sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
    from app.services.po_item_import_service import parse_po_item_master_excel

    login = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "admin", "password": "Admin@123"},
        timeout=30,
    )
    login.raise_for_status()
    switched = requests.post(
        f"{BASE_URL}/api/v1/auth/switch-context",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        json={"target_company_id": "COMP-001", "target_branch_id": "BR-MAIN-001"},
        timeout=30,
    )
    switched.raise_for_status()
    headers = {
        "Authorization": f"Bearer {switched.json()['access_token']}",
        "Content-Type": "application/json",
    }

    vendors = requests.get(f"{BASE_URL}/api/v1/vendors/", headers=headers, params={"limit": 500}, timeout=30).json()
    vendor_by_code = {vendor.get("code"): vendor for vendor in vendors}
    rename_results = []
    for letter in "ABCDEFGHIJ":
        code = f"V-00{letter}"
        vendor = vendor_by_code.get(code)
        if not vendor:
            continue
        response = requests.put(
            f"{BASE_URL}/api/v1/vendors/{vendor['id']}",
            headers=headers,
            json={"legalName": code, "tradeName": code},
            timeout=30,
        )
        rename_results.append((code, response.status_code))

    values = requests.get(
        f"{BASE_URL}/api/v1/masters/lookup/style_article/values",
        headers=headers,
        params={"activeOnly": "true"},
        timeout=30,
    ).json()
    values_by_article = {value.get("code"): value for value in values}
    articles = [
        item["style_code"]
        for item in parse_po_item_master_excel(WORKBOOK.read_bytes())
    ]

    assignment_results = []
    for article in articles:
        vendor_code = f"V-00{article.rsplit('-', 1)[-1].upper()}"
        value = values_by_article.get(article)
        if not value:
            assignment_results.append((article, "MISSING_ARTICLE", vendor_code))
            continue
        response = requests.put(
            f"{BASE_URL}/api/v1/masters/lookup/style_article/values/{value['id']}",
            headers=headers,
            json={"vendorCode": vendor_code},
            timeout=30,
        )
        assignment_results.append((article, response.status_code, vendor_code))

    print(json.dumps({
        "renamed": rename_results,
        "assigned": [result for result in assignment_results if result[1] == 200],
        "failed": [result for result in assignment_results if result[1] != 200],
    }, indent=2))


if __name__ == "__main__":
    main()
