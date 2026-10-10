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

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CONNECTOR_ORCHESTRATOR", role="SERVICE", canonicalOwner="backend/app/services/databridge/connectors/orchestrator.py")

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union

from .base import BaseDataBridgeConnector
from .tally_connector import TallyPrimeConnector
from .shopify_connector import ShopifyConnector
from .sap_b1_connector import SAPB1Connector
from .unicommerce_connector import UnicommerceConnector
from ..models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
    DataBridgeConnectorDescriptor,
    DataBridgeConnectorTestRequest,
    DataBridgeConnectorTestResponse,
    DataBridgeConnectorPullRequest,
    DataBridgeConnectorPullResponse,
    DataBridgeConnectorPushRequest,
    DataBridgeConnectorPushResponse,
)


class DataBridgeConnectorOrchestrator:
    """
    Central Registry and Execution Orchestrator for all external DataBridge connectors.
    Coordinates connection verification, ingestion/pull extraction, statutory normalization,
    and outbound push serialization.
    """

    _registry: Dict[DataBridgeConnectorType, BaseDataBridgeConnector] = {}

    @classmethod
    def _initialize_registry(cls) -> None:
        if not cls._registry:
            cls.register_connector(TallyPrimeConnector())
            cls.register_connector(ShopifyConnector())
            cls.register_connector(SAPB1Connector())
            cls.register_connector(UnicommerceConnector())

    @classmethod
    def register_connector(cls, connector: BaseDataBridgeConnector) -> None:
        """Registers a connector instance."""
        cls._registry[connector.connector_type] = connector

    @classmethod
    def list_connectors(cls) -> List[DataBridgeConnectorDescriptor]:
        """Returns descriptors for all registered connectors."""
        cls._initialize_registry()
        return [c.get_descriptor() for c in cls._registry.values()]

    @classmethod
    def get_connector(cls, connector_type: Union[DataBridgeConnectorType, str]) -> BaseDataBridgeConnector:
        """Retrieves connector instance by type."""
        cls._initialize_registry()
        if isinstance(connector_type, str):
            try:
                connector_type = DataBridgeConnectorType(connector_type)
            except ValueError as err:
                raise ValueError(f"Unknown connector type: '{connector_type}'") from err

        connector = cls._registry.get(connector_type)
        if not connector:
            raise ValueError(f"No connector registered for type '{connector_type.value}'")
        return connector

    @classmethod
    async def test_connection(cls, req: DataBridgeConnectorTestRequest) -> DataBridgeConnectorTestResponse:
        """Tests credentials and reachability for the given connector."""
        connector = cls.get_connector(req.connector_type)
        return await connector.test_connection(req.config)

    @classmethod
    async def pull_and_transform(cls, req: DataBridgeConnectorPullRequest) -> DataBridgeConnectorPullResponse:
        """
        Pulls raw records from connector and normalizes them into canonical SMRITI DataBridge tabular rows.
        """
        connector = cls.get_connector(req.connector_type)
        raw_records = await connector.pull_records(
            config=req.config,
            entity_type=req.entity_type,
            params=req.params,
            raw_payload=req.raw_payload,
        )

        transformed_rows = connector.transform_to_databridge_rows(
            raw_records=raw_records,
            entity_type=req.entity_type,
        )

        return DataBridgeConnectorPullResponse(
            connector_type=req.connector_type.value,
            entity_type=req.entity_type.value,
            total_records_pulled=len(transformed_rows),
            rows=transformed_rows,
            pulled_at=datetime.now(timezone.utc).isoformat(),
            metadata={"raw_record_count": len(raw_records)},
        )

    @classmethod
    async def push_records(cls, req: DataBridgeConnectorPushRequest) -> DataBridgeConnectorPushResponse:
        """
        Formats canonical SMRITI records into external vendor format and executes push.
        """
        connector = cls.get_connector(req.connector_type)
        return await connector.push_records(
            config=req.config,
            entity_type=req.entity_type,
            records=req.records,
            params=req.params,
        )
