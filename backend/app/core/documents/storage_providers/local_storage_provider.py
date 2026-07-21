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
Classification: Local Filesystem Storage Provider
"""

import hashlib
import tempfile
from pathlib import Path
from typing import Tuple
from app.core.documents.storage_providers.base_storage_provider import BaseStorageProvider


class LocalStorageProvider(BaseStorageProvider):
    """Local Filesystem & NAS Storage Provider."""

    def __init__(self, base_storage_dir: str = None):
        super().__init__("local", "Local Filesystem & NAS Storage")
        if base_storage_dir is None:
            self.base_dir = Path(tempfile.gettempdir()) / "smriti_udms_storage"
        else:
            self.base_dir = Path(base_storage_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, document_id: str, version: int, filename: str, content: bytes) -> Tuple[str, str]:
        sha256 = hashlib.sha256(content).hexdigest()
        doc_dir = self.base_dir / document_id / f"v{version}"
        doc_dir.mkdir(parents=True, exist_ok=True)
        file_path = doc_dir / filename

        with open(file_path, "wb") as f:
            f.write(content)

        return str(file_path), sha256

    def read_file(self, storage_path: str) -> bytes:
        with open(storage_path, "rb") as f:
            return f.read()
