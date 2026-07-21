"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 17.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Abstract Storage Provider Interface
"""

from abc import ABC, abstractmethod
from typing import Tuple


class BaseStorageProvider(ABC):
    """Abstract Base Storage Provider Interface (SMP-014 Compliant)."""

    def __init__(self, provider_id: str, name: str):
        self.provider_id = provider_id
        self.name = name

    @abstractmethod
    def save_file(self, document_id: str, version: int, filename: str, content: bytes) -> Tuple[str, str]:
        """Saves file content returning (storage_path, sha256_checksum)."""
        pass

    @abstractmethod
    def read_file(self, storage_path: str) -> bytes:
        """Reads file content from storage."""
        pass
