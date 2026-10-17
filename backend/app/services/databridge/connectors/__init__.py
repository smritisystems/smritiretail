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

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CONNECTOR_PACKAGE", role="PACKAGE", canonicalOwner="backend/app/services/databridge/connectors/__init__.py")

from .base import BaseDataBridgeConnector
from .tally_connector import TallyPrimeConnector
from .shopify_connector import ShopifyConnector
from .sap_b1_connector import SAPB1Connector
from .unicommerce_connector import UnicommerceConnector
from .orchestrator import DataBridgeConnectorOrchestrator

__all__ = [
    "BaseDataBridgeConnector",
    "TallyPrimeConnector",
    "ShopifyConnector",
    "SAPB1Connector",
    "UnicommerceConnector",
    "DataBridgeConnectorOrchestrator",
]
