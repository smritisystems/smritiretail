"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Type, List, Optional
from .contracts import BaseDocumentLifecycleHandler
from .exceptions import LifecycleException


class LifecycleRegistry:
    """
    Central Dynamic Registry for Document Lifecycle Handlers.
    Decouples UniversalLifecycleEngine from specific business document domains.
    """

    _handlers: Dict[str, BaseDocumentLifecycleHandler] = {}

    @classmethod
    def _normalize_key(cls, doc_type: str) -> str:
        return str(doc_type).strip().replace("_", "").replace("-", "").upper()

    @classmethod
    def register(cls, doc_type: str, handler_cls: Type[BaseDocumentLifecycleHandler]) -> None:
        """Registers a handler class for a document type key."""
        key = cls._normalize_key(doc_type)
        instance = handler_cls()
        cls._handlers[key] = instance

    @classmethod
    def get(cls, doc_type: str) -> BaseDocumentLifecycleHandler:
        """Retrieves the registered handler for the given document type."""
        key = cls._normalize_key(doc_type)
        handler = cls._handlers.get(key)
        if not handler:
            supported = cls.list_supported()
            raise LifecycleException(
                message=f"No lifecycle handler registered for document type '{doc_type}'. Supported: {supported}",
                status_code=400,
                details={"doc_type": doc_type, "supported_types": supported},
            )
        return handler

    @classmethod
    def list_supported(cls) -> List[str]:
        """Returns list of all registered handler document types."""
        return [h.document_type for h in cls._handlers.values() if h.document_type]


def register_lifecycle_handler(*doc_types: str):
    """Decorator to register a document lifecycle handler for one or more document type aliases."""
    def decorator(cls: Type[BaseDocumentLifecycleHandler]):
        for dt in doc_types:
            LifecycleRegistry.register(dt, cls)
        return cls
    return decorator
