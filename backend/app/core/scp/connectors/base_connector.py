"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-30
Modified     : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Platform Standard (SCP-001)

base_connector.py — SMRITI Compliance Platform (SCP v1.0 Kernel)
Abstract base connector class for external government portal gateways.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseGovernmentConnector(ABC):
    """
    Abstract contract for external government portal gateways (GSTN, NIC, Income Tax, MCA, MSME).
    """

    def __init__(self, connector_name: str, base_url: str):
        self.connector_name = connector_name
        self.base_url = base_url

    @abstractmethod
    async def authenticate(self, api_key: str, client_secret: str) -> bool:
        """Authenticates with the statutory government portal gateway."""
        pass

    @abstractmethod
    async def submit_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Submits serialized statutory payload to portal."""
        pass

    @abstractmethod
    async def fetch_filing_status(self, ack_number: str) -> Dict[str, Any]:
        """Fetches statutory filing status by acknowledgement number."""
        pass
