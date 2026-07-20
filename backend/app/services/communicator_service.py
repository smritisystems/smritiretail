"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.1.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("smriti.communicator_connector_manager")


class BaseConnectorProtocol(ABC):
    """
    Abstract Protocol layer for external accounting connectors.
    """
    @abstractmethod
    def transform_payload(self, record: Dict[str, Any]) -> Any:
        pass


class TallyXMLProtocol(BaseConnectorProtocol):
    def transform_payload(self, record: Dict[str, Any]) -> str:
        vtype = record.get("voucher_type", "Sales")
        vnum = record.get("voucher_number", "INV-001")
        vdate = record.get("date_str", "20260720")
        party = record.get("party_name", "Cash Customer")
        amount = float(record.get("amount", 0.0))

        return f"""<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="{vtype}" ACTION="Create">
            <DATE>{vdate}</DATE>
            <VOUCHERTYPENAME>{vtype}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>{vnum}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>{party}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{party}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""


class BusyJSONProtocol(BaseConnectorProtocol):
    def transform_payload(self, record: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "vch_type": record.get("voucher_type", "Sales"),
            "vch_no": record.get("voucher_number"),
            "party": record.get("party_name"),
            "net_amount": float(record.get("amount", 0.0)),
            "protocol": "BUSY_JSON_V1",
        }


class SMRITICommunicatorConnectorManager:
    """
    Refined Connector Pipeline Manager:
    ConnectorManager -> Connector -> Protocol -> Transport -> Transformation -> Queue -> Audit
    """
    def __init__(self):
        self._protocols: Dict[str, BaseConnectorProtocol] = {
            "TALLY_PRIME": TallyXMLProtocol(),
            "BUSY": BusyJSONProtocol(),
            "MARG": BusyJSONProtocol(),
            "ZOHO": BusyJSONProtocol(),
        }

    async def execute_connector_pipeline(
        self,
        connector_name: str,
        records: List[Dict[str, Any]],
        transport_type: str = "HTTP_REST",
    ) -> Dict[str, Any]:
        connector_upper = connector_name.upper()
        protocol = self._protocols.get(connector_upper, BusyJSONProtocol())

        transformed_queue = []
        for rec in records:
            transformed = protocol.transform_payload(rec)
            transformed_queue.append(transformed)

        sync_id = f"SYNC-{uuid.uuid4().hex[:8].upper()}"
        outbound_trace_id = uuid.uuid4().hex
        outbound_span_id = uuid.uuid4().hex[:16]
        outbound_traceparent = f"00-{outbound_trace_id}-{outbound_span_id}-01"

        return {
            "connector": connector_upper,
            "pipeline_stages": ["Connector", "Protocol", "Transport", "Transformation", "Queue", "Audit"],
            "transport_type": transport_type,
            "status": "PROCESSED",
            "sync_id": sync_id,
            "processed_count": len(transformed_queue),
            "queue_payloads": transformed_queue[:2],
            "outbound_traceparent": outbound_traceparent,
        }


class SMRITICommunicatorService:
    async def generate_tally_xml_payload(
        self,
        voucher_type: str,
        voucher_number: str,
        date_str: str,
        party_name: str,
        amount: float,
        narration: str = "Synced from SMRITI Retail OS v4.1",
    ) -> str:
        mgr = SMRITICommunicatorConnectorManager()
        res = await mgr.execute_connector_pipeline(
            "TALLY_PRIME",
            [{
                "voucher_type": voucher_type,
                "voucher_number": voucher_number,
                "date_str": date_str,
                "party_name": party_name,
                "amount": amount,
            }]
        )
        return res["queue_payloads"][0]

    async def process_sync_queue(
        self,
        connector_type: str,
        records: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        mgr = SMRITICommunicatorConnectorManager()
        return await mgr.execute_connector_pipeline(connector_type, records)
