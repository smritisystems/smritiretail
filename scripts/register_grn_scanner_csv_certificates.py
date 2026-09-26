"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-09-20
Modified     : 2026-09-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

assets = [
    {
        "entity": "purchase",
        "capability": "purchase.landed_cost_engine",
        "asset_type": "component",
        "proposed_name": "GrnCameraScannerModal.tsx",
        "target_file_path": "src/components/purchase/GrnCameraScannerModal.tsx",
        "decision": "CREATE_NEW",
        "canonical_owner": "src/components/purchase/GrnCameraScannerModal.tsx",
    },
    {
        "entity": "purchase",
        "capability": "purchase.landed_cost_engine",
        "asset_type": "component",
        "proposed_name": "GrnCsvImportModal.tsx",
        "target_file_path": "src/components/purchase/GrnCsvImportModal.tsx",
        "decision": "CREATE_NEW",
        "canonical_owner": "src/components/purchase/GrnCsvImportModal.tsx",
    },
]

for asset in assets:
    full_path = os.path.join(REPO_ROOT, asset["target_file_path"].replace("/", os.sep))
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    cert = PreflightCertificateManager.issue_certificate(
        entity=asset["entity"],
        capability=asset["capability"],
        asset_type=asset["asset_type"],
        proposed_name=asset["proposed_name"],
        decision=asset["decision"],
        canonical_owner=asset["canonical_owner"],
        target_file_path=asset["target_file_path"],
        content=content,
    )
    print(f"Issued certificate {cert['certificate_id']} for {asset['target_file_path']}")
