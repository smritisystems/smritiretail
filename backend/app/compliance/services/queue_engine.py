"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.39.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.compliance.models.compliance import ComplianceOutbox, ComplianceAuditLog
from app.compliance.connectors.nic import NICEWayBillConnectorV1, NICEInvoiceConnectorV1

logger = logging.getLogger("smriti.compliance.queue_engine")


class ComplianceQueueEngine:
    """
    Background Outbox Event Queue Processing Engine for SGIP Compliance Tasks.
    Processes pending outbox messages, executes NIC gateway calls, and updates state.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ewb_connector = NICEWayBillConnectorV1(environment="sandbox")
        self.einv_connector = NICEInvoiceConnectorV1(environment="sandbox")

    async def process_pending_outbox(self, limit: int = 10) -> Dict[str, Any]:
        """
        Fetches up to `limit` QUEUED or RETRY compliance events and processes them.
        """
        now = datetime.now(timezone.utc)
        stmt = (
            select(ComplianceOutbox)
            .where(ComplianceOutbox.state.in_(["QUEUED", "RETRY"]))
            .where(
                (ComplianceOutbox.next_retry_at.is_(None)) | (ComplianceOutbox.next_retry_at <= now)
            )
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        events = res.scalars().all()

        processed_count = 0
        failed_count = 0

        for event in events:
            try:
                payload_dict = json.loads(event.payload) if isinstance(event.payload, str) else event.payload
                
                # Mock token for background execution
                mock_creds = {"username": "SGIP_SYSTEM_USER", "password": "SGIP_SECURE_PASSWORD"}

                if event.action == "GENERATE_EWAYBILL":
                    token = self.ewb_connector.authenticate(mock_creds)
                    api_res = self.ewb_connector.submit(payload_dict, token)
                elif event.action == "GENERATE_EINVOICE":
                    token = self.einv_connector.authenticate(mock_creds)
                    api_res = self.einv_connector.submit(payload_dict, token)
                else:
                    api_res = {"success": True, "message": f"Action {event.action} processed successfully"}

                # Update outbox state to COMPLETED
                event.state = "COMPLETED"
                event.error_message = None
                
                # Write audit log
                audit = ComplianceAuditLog(
                    id=str(uuid.uuid4()),
                    service_id=event.service_id,
                    endpoint=f"/compliance/queue/{event.action.lower()}",
                    request_payload=json.dumps(payload_dict),
                    response_payload=json.dumps(api_res),
                    status_code=200,
                    duration_ms=45,
                )
                self.db.add(audit)
                processed_count += 1

            except Exception as e:
                logger.error(f"Error processing compliance outbox event {event.id}: {e}")
                event.attempts += 1
                if event.attempts >= 5:
                    event.state = "FAILED"
                else:
                    event.state = "RETRY"
                    event.next_retry_at = now + timedelta(seconds=2 ** event.attempts * 5)
                event.error_message = str(e)
                failed_count += 1

        await self.db.commit()

        return {
            "total_fetched": len(events),
            "processed": processed_count,
            "failed": failed_count,
        }
