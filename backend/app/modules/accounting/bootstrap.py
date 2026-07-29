"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 13.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Accounting Module Bootstrap
"""

import logging
from typing import Dict, Any
from app.core.spk_kernel import SmritiModule, ModuleContext, RegistryManager

logger = logging.getLogger("smriti.modules.accounting")


class AccountingModule(SmritiModule):
    """Accounting Module Implementation."""

    async def install(self, context: ModuleContext) -> None:
        logger.info("[AccountingModule] Installed successfully.")

    async def uninstall(self, context: ModuleContext) -> None:
        logger.info("[AccountingModule] Uninstalled successfully.")

    async def enable(self, context: ModuleContext) -> None:
        logger.info("[AccountingModule] Enabled successfully.")

    async def disable(self, context: ModuleContext) -> None:
        logger.info("[AccountingModule] Disabled successfully.")

    async def upgrade(self, context: ModuleContext, from_version: str) -> None:
        logger.info("[AccountingModule] Upgraded from %s to 13.0.0.", from_version)

    async def health(self, context: ModuleContext) -> Dict[str, Any]:
        return {
            "status": "HEALTHY",
            "is_healthy": True,
            "module_id": "accounting",
            "critical": False
        }

    def register(self, registry_manager: RegistryManager) -> None:
        registry_manager.register_menu({ "id": "menu_chart_of_accounts", "label": "Chart of Accounts", "path": "/accounting/accounts" })
        registry_manager.register_route("/api/v1/accounting/accounts")
        registry_manager.register_permission("account.view")
