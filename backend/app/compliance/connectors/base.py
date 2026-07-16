"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from abc import ABC, abstractmethod


class ConnectorV1(ABC):
    """
    Abstract Base Class for all versioned government compliance connectors.
    Connectors are strictly stateless.
    """

    @abstractmethod
    def authenticate(self, credentials: dict) -> str:
        """
        Authenticates against the government service and returns a token.
        """
        pass

    @abstractmethod
    def submit(self, payload: dict, token: str) -> dict:
        """
        Submits compliance payload (e.g. generate e-way bill).
        """
        pass

    @abstractmethod
    def cancel(self, document_no: str, reason: str, token: str) -> dict:
        """
        Cancels an already submitted compliance document.
        """
        pass
