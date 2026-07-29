"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 30.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Customer License Management Engine
"""

from typing import Dict, Any, List


class CustomerLicenseService:
    """Manages license keys, edition features, store limits, and terminal caps."""

    @classmethod
    def get_tenant_licenses(cls, tenant_id: str = "TENANT-001") -> List[Dict[str, Any]]:
        return [
            {
                "license_key": "SMRITI-ENT-2026-99A8-44BC",
                "edition": "ENTERPRISE",
                "status": "ACTIVE",
                "tenant_id": tenant_id,
                "activation_date": "2026-01-01",
                "expiry_date": "2027-12-31",
                "max_stores": 10,
                "max_warehouses": 5,
                "max_pos_terminals": 50,
                "enabled_modules": [
                    "pos_billing", "wms_inventory", "pharma_engine",
                    "apparel_matrix", "nic_gst", "franchise_royalty", "loyalty_rewards"
                ],
                "feature_flags": [
                    "offline_checkout_enabled", "near_expiry_lock_enabled",
                    "einvoice_auto_filing", "ai_markdown_advisory"
                ],
                "current_usage": {
                    "active_stores": 4,
                    "active_warehouses": 2,
                    "active_pos_terminals": 18
                }
            }
        ]

    @classmethod
    def validate_terminal_cap(cls, tenant_id: str, current_terminals: int) -> Dict[str, Any]:
        licenses = cls.get_tenant_licenses(tenant_id)
        max_cap = sum(l["max_pos_terminals"] for l in licenses if l["status"] == "ACTIVE")
        allowed = current_terminals < max_cap

        return {
            "tenant_id": tenant_id,
            "current_terminals": current_terminals,
            "maximum_capacity": max_cap,
            "allowed": allowed,
            "reason": "Capacity available" if allowed else "Terminal capacity limit reached"
        }
