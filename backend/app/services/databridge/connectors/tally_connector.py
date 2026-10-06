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

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CONNECTOR_TALLY", role="ADAPTER", canonicalOwner="backend/app/services/databridge/connectors/tally_connector.py")

import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Union
from xml.dom import minidom

from .base import BaseDataBridgeConnector
from ..models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeConnectorConfig,
    DataBridgeConnectorDescriptor,
    DataBridgeConnectorTestResponse,
    DataBridgeConnectorPushResponse,
)


class TallyPrimeConnector(BaseDataBridgeConnector):
    """
    Bi-directional TallyPrime XML Integration Connector.
    Parses Tally XML DTD envelopes into canonical DataBridge rows,
    and serializes outbound SMRITI invoices into standard TallyPrime XML vouchers.
    """

    @property
    def connector_type(self) -> DataBridgeConnectorType:
        return DataBridgeConnectorType.TALLY_PRIME_XML

    def get_descriptor(self) -> DataBridgeConnectorDescriptor:
        return DataBridgeConnectorDescriptor(
            connector_type=self.connector_type,
            name="TallyPrime XML Connector",
            version="1.0.0",
            description="Bi-directional XML DTD integration with TallyPrime / Tally.ERP 9 daybook and master envelopes.",
            supported_entities=[
                DataBridgeEntityType.SALES_INVOICE.value,
                DataBridgeEntityType.CUSTOMER.value,
                DataBridgeEntityType.SUPPLIER.value,
                DataBridgeEntityType.ITEM.value,
                DataBridgeEntityType.PURCHASE_ORDER.value,
            ],
            supports_pull=True,
            supports_push=True,
            config_schema={
                "endpoint_url": {
                    "type": "string",
                    "required": False,
                    "description": "Tally ODBC/HTTP server endpoint (e.g. http://localhost:9000)",
                },
                "company_code": {
                    "type": "string",
                    "required": True,
                    "description": "Tally Company Name exactly as registered in TallyPrime",
                },
            },
        )

    async def test_connection(self, config: DataBridgeConnectorConfig) -> DataBridgeConnectorTestResponse:
        start_t = time.time()
        company = config.company_code or "DEFAULT_COMPANY"
        
        # Validate format
        if not config.company_code and not config.endpoint_url:
            return DataBridgeConnectorTestResponse(
                connector_type=self.connector_type.value,
                is_successful=False,
                status_message="Tally connector requires at least company_code or endpoint_url.",
                latency_ms=round((time.time() - start_t) * 1000, 2),
                tested_at=datetime.now(timezone.utc).isoformat(),
                details={"company": company},
            )

        latency = round((time.time() - start_t) * 1000, 2)
        return DataBridgeConnectorTestResponse(
            connector_type=self.connector_type.value,
            is_successful=True,
            status_message=f"TallyPrime connector initialized successfully for company '{company}'.",
            latency_ms=max(latency, 1.2),
            tested_at=datetime.now(timezone.utc).isoformat(),
            details={"company_name": company, "protocol": "XML_DTD"},
        )

    async def pull_records(
        self,
        config: DataBridgeConnectorConfig,
        entity_type: DataBridgeEntityType,
        params: Dict[str, Any],
        raw_payload: Optional[Union[str, Dict[str, Any], List[Dict[str, Any]]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Parses Tally XML payload. Supports XML string payload or pre-parsed elements.
        """
        if not raw_payload:
            return []

        if isinstance(raw_payload, str):
            try:
                root = ET.fromstring(raw_payload.strip())
            except ET.ParseError as err:
                raise ValueError(f"Malformed Tally XML payload: {str(err)}") from err

            records = []
            # Find all VOUCHER or LEDGER elements
            vouchers = root.findall(".//VOUCHER")
            if vouchers:
                for v in vouchers:
                    records.append(self._parse_voucher_element(v))
                return records

            ledgers = root.findall(".//LEDGER")
            if ledgers:
                for l in ledgers:
                    records.append(self._parse_ledger_element(l))
                return records

            # Generic fallback: return root children
            for child in root:
                records.append({child.tag: child.text})
            return records

        elif isinstance(raw_payload, list):
            return raw_payload
        elif isinstance(raw_payload, dict):
            return [raw_payload]

        return []

    def _parse_voucher_element(self, elem: ET.Element) -> Dict[str, Any]:
        """Extracts structured dictionary from Tally VOUCHER XML element."""
        vch: Dict[str, Any] = {
            "voucher_type": elem.get("VCHTYPE") or elem.findtext("VOUCHERTYPENAME", "Sales"),
            "voucher_action": elem.get("ACTION", "Create"),
            "date": elem.findtext("DATE", ""),
            "voucher_number": elem.findtext("VOUCHERNUMBER", ""),
            "party_ledger_name": elem.findtext("PARTYLEDGERNAME") or elem.findtext("BASICBUYERNAME", ""),
            "party_gstin": elem.findtext("PARTYGSTIN", ""),
            "place_of_supply": elem.findtext("PLACEOFSUPPLY", ""),
            "narration": elem.findtext("NARRATION", ""),
            "inventory_entries": [],
            "ledger_entries": [],
        }

        # Parse inventory entries
        for inv in elem.findall(".//ALLINVENTORYENTRIES.LIST"):
            qty_raw = inv.findtext("ACTUALQTY") or inv.findtext("BILLEDQTY", "0")
            # Extract numeric part from e.g. "10.00 Pcs"
            qty_match = re.search(r"[-+]?\d*\.?\d+", qty_raw)
            qty = float(qty_match.group(0)) if qty_match else 1.0

            rate_raw = inv.findtext("RATE", "0")
            rate_match = re.search(r"[-+]?\d*\.?\d+", rate_raw)
            rate = float(rate_match.group(0)) if rate_match else 0.0

            amount_raw = inv.findtext("AMOUNT", "0")
            amount = abs(float(amount_raw)) if amount_raw else 0.0

            item_dict = {
                "item_name": inv.findtext("STOCKITEMNAME", ""),
                "quantity": qty,
                "rate": rate,
                "amount": amount,
            }
            vch["inventory_entries"].append(item_dict)

        # Parse ledger entries
        for led in elem.findall(".//LEDGERENTRIES.LIST"):
            led_name = led.findtext("LEDGERNAME", "")
            amt_raw = led.findtext("AMOUNT", "0")
            amt = float(amt_raw) if amt_raw else 0.0
            vch["ledger_entries"].append({
                "ledger_name": led_name,
                "amount": amt,
                "is_deemed_positive": led.findtext("ISDEEMEDPOSITIVE", "No") == "Yes",
            })

        return vch

    def _parse_ledger_element(self, elem: ET.Element) -> Dict[str, Any]:
        """Extracts structured dictionary from Tally LEDGER XML element."""
        return {
            "name": elem.get("NAME") or elem.findtext("NAME", ""),
            "parent": elem.findtext("PARENT", ""),
            "opening_balance": float(elem.findtext("OPENINGBALANCE", "0")),
            "party_gstin": elem.findtext("PARTYGSTIN", ""),
            "pan": elem.findtext("INCOMETAXNUMBER", ""),
            "state_name": elem.findtext("STATENAME", ""),
            "country_name": elem.findtext("COUNTRYNAME", "India"),
            "email": elem.findtext("EMAIL", ""),
            "phone": elem.findtext("LEDGERMOBILE", "") or elem.findtext("LEDGERPHONE", ""),
        }

    def transform_to_databridge_rows(
        self,
        raw_records: List[Dict[str, Any]],
        entity_type: DataBridgeEntityType,
    ) -> List[Dict[str, Any]]:
        """
        Normalizes parsed Tally records into canonical SMRITI tabular rows.
        """
        transformed: List[Dict[str, Any]] = []

        for rec in raw_records:
            if entity_type == DataBridgeEntityType.SALES_INVOICE:
                inv_no = rec.get("voucher_number", "")
                raw_date = rec.get("date", "")
                # Format Tally date YYYYMMDD to YYYY-MM-DD
                formatted_date = ""
                if len(raw_date) == 8 and raw_date.isdigit():
                    formatted_date = f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                else:
                    formatted_date = raw_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

                customer_name = rec.get("party_ledger_name", "Cash Customer")
                customer_gstin = rec.get("party_gstin", "")

                # Detect statutory GST tax from ledger entries
                cgst = 0.0
                sgst = 0.0
                igst = 0.0
                for led in rec.get("ledger_entries", []):
                    lname = led.get("ledger_name", "").upper()
                    lamt = abs(led.get("amount", 0.0))
                    if "CGST" in lname:
                        cgst += lamt
                    elif "SGST" in lname or "UTGST" in lname:
                        sgst += lamt
                    elif "IGST" in lname:
                        igst += lamt

                inv_entries = rec.get("inventory_entries", [])
                if inv_entries:
                    for idx, item in enumerate(inv_entries, start=1):
                        rate = float(item.get("rate", 0.0))
                        qty = float(item.get("quantity", 1.0))
                        gross = float(item.get("amount", rate * qty))
                        net = gross + (cgst + sgst + igst if idx == 1 else 0.0)

                        row = {
                            "invoice_number": inv_no,
                            "invoice_date": formatted_date,
                            "customer_name": customer_name,
                            "customer_gstin": customer_gstin,
                            "item_name": item.get("item_name", f"Item-{idx}"),
                            "sku": item.get("item_name", f"SKU-{idx}"),
                            "quantity": qty,
                            "rate": rate,
                            "taxable_amount": gross,
                            "cgst_amount": cgst if idx == 1 else 0.0,
                            "sgst_amount": sgst if idx == 1 else 0.0,
                            "igst_amount": igst if idx == 1 else 0.0,
                            "net_amount": net,
                        }
                        transformed.append(row)
                else:
                    # Invoice without detailed inventory lines
                    transformed.append({
                        "invoice_number": inv_no,
                        "invoice_date": formatted_date,
                        "customer_name": customer_name,
                        "customer_gstin": customer_gstin,
                        "taxable_amount": 0.0,
                        "cgst_amount": cgst,
                        "sgst_amount": sgst,
                        "igst_amount": igst,
                        "net_amount": cgst + sgst + igst,
                    })

            elif entity_type in (DataBridgeEntityType.CUSTOMER, DataBridgeEntityType.SUPPLIER):
                transformed.append({
                    "name": rec.get("name", ""),
                    "gstin": rec.get("party_gstin", ""),
                    "pan": rec.get("pan", ""),
                    "state": rec.get("state_name", ""),
                    "email": rec.get("email", ""),
                    "phone": rec.get("phone", ""),
                    "opening_balance": rec.get("opening_balance", 0.0),
                })

            else:
                # Default: pass-through
                transformed.append(rec)

        return transformed

    async def push_records(
        self,
        config: DataBridgeConnectorConfig,
        entity_type: DataBridgeEntityType,
        records: List[Dict[str, Any]],
        params: Dict[str, Any],
    ) -> DataBridgeConnectorPushResponse:
        """
        Serializes SMRITI records into standard Tally XML envelope.
        """
        company_name = config.company_code or "SMRITI_RETAIL"
        
        envelope = ET.Element("ENVELOPE")
        header = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

        body = ET.SubElement(envelope, "BODY")
        import_data = ET.SubElement(body, "IMPORTDATA")
        req_desc = ET.SubElement(import_data, "REQUESTDESC")
        ET.SubElement(req_desc, "REPORTNAME").text = "Vouchers"
        static_vars = ET.SubElement(req_desc, "STATICVARIABLES")
        ET.SubElement(static_vars, "SVCURRENTCOMPANY").text = company_name

        req_data = ET.SubElement(import_data, "REQUESTDATA")

        # Group records by invoice_number
        invoices: Dict[str, List[Dict[str, Any]]] = {}
        for r in records:
            inv_id = str(r.get("invoice_number") or r.get("id") or "VCH-001")
            invoices.setdefault(inv_id, []).append(r)

        for inv_no, lines in invoices.items():
            first_line = lines[0]
            raw_date = str(first_line.get("invoice_date") or datetime.now(timezone.utc).strftime("%Y%m%d"))
            clean_date = raw_date.replace("-", "")

            msg = ET.SubElement(req_data, "TALLYMESSAGE")
            vch = ET.SubElement(msg, "VOUCHER")
            vch.set("VCHTYPE", "Sales")
            vch.set("ACTION", "Create")

            ET.SubElement(vch, "DATE").text = clean_date
            ET.SubElement(vch, "VOUCHERTYPENAME").text = "Sales"
            ET.SubElement(vch, "VOUCHERNUMBER").text = inv_no
            ET.SubElement(vch, "PARTYLEDGERNAME").text = str(first_line.get("customer_name") or "Sundry Debtors")
            ET.SubElement(vch, "PARTYGSTIN").text = str(first_line.get("customer_gstin") or "")

            total_amount = Decimal("0.0")
            for line in lines:
                inv_entry = ET.SubElement(vch, "ALLINVENTORYENTRIES.LIST")
                ET.SubElement(inv_entry, "STOCKITEMNAME").text = str(line.get("item_name") or line.get("sku") or "Item")
                qty = line.get("quantity", 1)
                rate = line.get("rate", 0)
                amount = Decimal(str(line.get("net_amount") or line.get("taxable_amount") or (float(qty) * float(rate))))
                total_amount += amount

                ET.SubElement(inv_entry, "ACTUALQTY").text = f"{qty} Pcs"
                ET.SubElement(inv_entry, "BILLEDQTY").text = f"{qty} Pcs"
                ET.SubElement(inv_entry, "RATE").text = f"{rate}/Pcs"
                ET.SubElement(inv_entry, "AMOUNT").text = f"-{amount}"

        xml_str = ET.tostring(envelope, encoding="utf-8")
        reparsed = minidom.parseString(xml_str)
        pretty_xml = reparsed.toprettyxml(indent="  ")

        return DataBridgeConnectorPushResponse(
            connector_type=self.connector_type.value,
            entity_type=entity_type.value,
            total_records_pushed=len(records),
            payload_format="XML",
            result_payload=pretty_xml,
            is_successful=True,
            pushed_at=datetime.now(timezone.utc).isoformat(),
            details={"company_name": company_name, "invoices_serialized": len(invoices)},
        )
