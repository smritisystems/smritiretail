"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 14.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Offline Air-Gapped USB Repository Provider
"""

from typing import Dict, Any, List, Optional
from app.core.marketplace.providers.filesystem_provider import FilesystemRepositoryProvider


class OfflineUSBRepositoryProvider(FilesystemRepositoryProvider):
    """Air-Gapped Offline USB Drive Repository Provider."""

    def __init__(self, usb_drive_path: str):
        super().__init__(usb_drive_path)
        self.repository_id = "offline_usb"
        self.name = "Air-Gapped USB Drive Repository"
        self.provider_type = "OFFLINE_USB"
