"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 26.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Direct E-Way Bill Dispatch Engine
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, Any


class NICEWayBillEngine:
    """E-Way Bill Generation & Threshold Evaluator Engine (> ₹50,000)."""

    EWAY_BILL_THRESHOLD = 50000.0  # Mandatory E-Way bill if consignment > Rs 50,000

    @classmethod
    def generate_eway_bill(cls, invoice_number: str, transporter_id: str, vehicle_number: str, consignment_value: float, distance_km: int = 100) -> Dict[str, Any]:
        if consignment_value < cls.EWAY_BILL_THRESHOLD:
            return {
                "invoice_number": invoice_number,
                "is_eway_bill_required": False,
                "reason": f"Consignment value (Rs.{consignment_value:.2f}) below Rs.50,000 threshold"
            }

        # Calculate validity: 1 day per 200 km
        validity_days = max(1, (distance_km + 199) // 200)
        valid_until = (datetime.utcnow() + timedelta(days=validity_days)).strftime("%Y-%m-%d %H:%M:%S")
        ewb_number = f"12{str(uuid.uuid4().int)[:10]}"

        return {
            "invoice_number": invoice_number,
            "is_eway_bill_required": True,
            "eway_bill_no": ewb_number,
            "transporter_id": transporter_id,
            "vehicle_number": vehicle_number.upper(),
            "consignment_value": consignment_value,
            "distance_km": distance_km,
            "valid_until": valid_until,
            "status": "EWAY_BILL_GENERATED"
        }
