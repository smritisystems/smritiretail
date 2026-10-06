"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Foundation Service
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CONNECTOR_FRAMEWORK", role="CORE", canonicalOwner="backend/app/services/databridge/connectors/base.py")

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
import time

from ..models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
    DataBridgeConnectorDescriptor,
    DataBridgeConnectorTestResponse,
    DataBridgeConnectorPushResponse,
)


class BaseDataBridgeConnector(ABC):
    """
    Abstract Base Class for all external third-party ERP, E-Commerce, and Accounting connectors.
    Provides standardized methods for connection validation, record extraction (pull),
    statutory data normalization into DataBridge rows, and outbound dispatch (push).
    """

    @property
    @abstractmethod
    def connector_type(self) -> DataBridgeConnectorType:
        """Returns the unique connector identifier."""
        pass

    @abstractmethod
    def get_descriptor(self) -> DataBridgeConnectorDescriptor:
        """Returns metadata, supported entities, and configuration schema."""
        pass

    @abstractmethod
    async def test_connection(self, config: DataBridgeConnectorConfig) -> DataBridgeConnectorTestResponse:
        """Tests credentials and network connectivity."""
        pass

    @abstractmethod
    async def pull_records(
        self,
        config: DataBridgeConnectorConfig,
        entity_type: DataBridgeEntityType,
        params: Dict[str, Any],
        raw_payload: Optional[Union[str, Dict[str, Any], List[Dict[str, Any]]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extracts raw records from external API or parses provided raw_payload.
        Returns a list of raw domain objects.
        """
        pass

    @abstractmethod
    def transform_to_databridge_rows(
        self,
        raw_records: List[Dict[str, Any]],
        entity_type: DataBridgeEntityType,
    ) -> List[Dict[str, Any]]:
        """
        Normalizes raw external vendor structures into canonical SMRITI DataBridge tabular rows.
        """
        pass

    @abstractmethod
    async def push_records(
        self,
        config: DataBridgeConnectorConfig,
        entity_type: DataBridgeEntityType,
        records: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> DataBridgeConnectorPushResponse:
        """
        Formats canonical SMRITI records into the external vendor's required format (e.g. Tally XML).
        """
        pass
