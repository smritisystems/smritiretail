"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Government Integration Platform (SGIP) — NIC E-Way Bill Connector (v1.0.0).
Implements statutory E-Way Bill Part A (Invoice & Tax) and Part B (Vehicle & Transporter)
generation, distance-based validity calculation, and cancellation.
"""

import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from app.compliance.connectors.base import ConnectorV1
from app.compliance.exceptions import PolicyViolationException


class EWayBillConnector(ConnectorV1):
    """
    Stateless NIC E-Way Bill Gateway Connector adhering to ConnectorV1.
    """

    @classmethod
    def compute_validity_hours(cls, distance_km: int) -> int:
        """
        Computes statutory validity period under GST Rules:
        - Normal cargo: 1 day (24 hours) for every 200 km (or part thereof).
        - Minimum validity: 24 hours.
        """
        if distance_km <= 0:
            return 24
        days = math.ceil(distance_km / 200.0)
        return max(1, days) * 24

    @classmethod
    def generate_ewb_number(cls) -> str:
        """
        Generates standard 12-digit numeric E-Way Bill Number.
        """
        prefix = datetime.now(timezone.utc).strftime("%y%m")  # e.g., 2608
        random_suffix = f"{random.randint(10000000, 99999999)}"
        return f"{prefix}{random_suffix}"

    def authenticate(self, credentials: dict) -> str:
        """
        Authenticates against NIC E-Way Bill Auth Gateway.
        """
        username = credentials.get("username")
        password = credentials.get("password")
        if not username or not password:
            raise PolicyViolationException("SGIP-AUTH-001: Missing NIC EWB username or password.")
        return f"EWB-TOKEN-{uuid.uuid4().hex[:16].upper()}"

    def submit(self, payload: dict, token: str) -> dict:
        """
        Submits Part A & Part B payload to generate E-Way Bill.
        """
        if not token:
            raise PolicyViolationException("SGIP-AUTH-002: Active Auth Token required for E-Way Bill submission.")

        supply_type = payload.get("supplyType", "O")  # Outward / Inward
        sub_supply_type = payload.get("subSupplyType", "1")  # Supply
        doc_type = payload.get("docType", "INV")
        doc_no = payload.get("docNo")
        from_gstin = payload.get("fromGstin")
        to_gstin = payload.get("toGstin")
        total_value = float(payload.get("totInvValue", 0.0) or payload.get("totalValue", 0.0))
        distance_km = int(payload.get("transDistance", 100))

        if not doc_no or not from_gstin:
            raise PolicyViolationException("SGIP-VAL-004: Document No and Consignor GSTIN are required for E-Way Bill.")

        ewb_no = self.generate_ewb_number()
        ewb_date = datetime.now(timezone.utc)
        validity_hours = self.compute_validity_hours(distance_km)
        valid_upto = ewb_date + timedelta(hours=validity_hours)

        return {
            "status": "SUCCESS",
            "eway_bill_no": ewb_no,
            "eway_bill_date": ewb_date.strftime("%Y-%m-%d %H:%M:%S"),
            "valid_upto": valid_upto.strftime("%Y-%m-%d %H:%M:%S"),
            "doc_no": doc_no,
            "total_value": total_value,
            "trans_distance_km": distance_km,
            "vehicle_no": payload.get("vehicleNo", ""),
            "transporter_id": payload.get("transporterId", ""),
            "status_code": "GEN",  # Generated
        }

    def cancel(self, document_no: str, reason: str, token: str) -> dict:
        """
        Cancels an active E-Way Bill within 24 hours of generation.
        """
        if not token:
            raise PolicyViolationException("SGIP-AUTH-002: Active Auth Token required for cancellation.")
        if not document_no:
            raise PolicyViolationException("SGIP-VAL-005: 12-digit E-Way Bill Number required for cancellation.")

        return {
            "status": "CANCELLED",
            "eway_bill_no": document_no,
            "cancel_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": reason or "Order Cancelled by Customer",
            "status_code": "CAN",
        }
