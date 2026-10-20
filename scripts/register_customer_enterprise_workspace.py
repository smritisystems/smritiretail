"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Architecture Registration
"""

import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
from lib.certificate_manager import PreflightCertificateManager

def register_customer_workspace():
    new_assets = [
        {
            "entity": "customer",
            "capability": "customer.crud",
            "asset_type": "component",
            "proposed_name": "CustomerHierarchyTree.tsx",
            "target_file_path": "src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx",
        },
        {
            "entity": "customer",
            "capability": "customer.crud",
            "asset_type": "component",
            "proposed_name": "CustomerMasterSideNav.tsx",
            "target_file_path": "src/components/customer/corporateWorkspace/CustomerMasterSideNav.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/customer/corporateWorkspace/CustomerMasterSideNav.tsx",
        },
        {
            "entity": "customer",
            "capability": "customer.crud",
            "asset_type": "component",
            "proposed_name": "CustomerSummaryCard.tsx",
            "target_file_path": "src/components/customer/corporateWorkspace/CustomerSummaryCard.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/customer/corporateWorkspace/CustomerSummaryCard.tsx",
        },
        {
            "entity": "customer",
            "capability": "customer.crud",
            "asset_type": "component",
            "proposed_name": "CustomerTaxInvoicePreview.tsx",
            "target_file_path": "src/components/customer/corporateWorkspace/CustomerTaxInvoicePreview.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/customer/corporateWorkspace/CustomerTaxInvoicePreview.tsx",
        },
        {
            "entity": "customer",
            "capability": "customer.crud",
            "asset_type": "component",
            "proposed_name": "EnterpriseCustomerMasterView.tsx",
            "target_file_path": "src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx",
        },
        {
            "entity": "customer",
            "capability": "customer.crud",
            "asset_type": "component",
            "proposed_name": "Customer360DashboardView.tsx",
            "target_file_path": "src/components/customer/corporate360/Customer360DashboardView.tsx",
            "decision": "CREATE_NEW",
            "canonical_owner": "src/components/customer/corporate360/Customer360DashboardView.tsx",
        },
    ]

    for asset in new_assets:
        full_path = os.path.join(REPO_ROOT, asset["target_file_path"].replace("/", os.sep))
        content = ""
        if os.path.exists(full_path):
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
        print(f"Issued certificate {cert.get('certificate_id')} for {asset['target_file_path']}")

if __name__ == "__main__":
    register_customer_workspace()
