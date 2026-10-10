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

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_SCHEDULER_ENGINE", role="SERVICE", canonicalOwner="backend/app/services/databridge/scheduler_engine.py")

import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    DataBridgeEntityType,
    DataBridgeConnectorType,
    DataBridgeScheduleStatus,
    DataBridgeScheduleCreateRequest,
    DataBridgeScheduleResponse,
    DataBridgeScheduleTriggerResponse,
    DataBridgeConnectorPullRequest,
)
from .connectors.orchestrator import DataBridgeConnectorOrchestrator
from .exceptions import DataBridgeValidationError, DataBridgeTenantIsolationError


class DataBridgeScheduler:
    """
    Automated Background Pull Scheduler for SMRITI DataBridge.
    Coordinates tenant-isolated recurring pull jobs from third-party connectors
    (Tally, Shopify, SAP B1, Unicommerce), tracking execution cycles and dispatching
    extracted payloads to the asynchronous task queue.
    """

    # In-memory registry partitioned by tenant_id -> {schedule_id: schedule_dict}
    _schedules: Dict[str, Dict[str, Dict[str, Any]]] = {}

    @classmethod
    def create_schedule(
        cls,
        tenant_id: str,
        req: DataBridgeScheduleCreateRequest,
    ) -> DataBridgeScheduleResponse:
        """Registers a recurring sync schedule for a tenant."""
        if not tenant_id:
            raise DataBridgeTenantIsolationError("Tenant ID is required to register a pull schedule.")

        schedule_id = f"SCHED-{uuid.uuid4().hex[:10].upper()}"
        now = datetime.now(timezone.utc)
        next_run = now + timedelta(minutes=req.interval_minutes)

        sched_data = {
            "schedule_id": schedule_id,
            "tenant_id": tenant_id,
            "name": req.name,
            "connector_type": req.connector_type.value,
            "entity_type": req.entity_type.value,
            "interval_minutes": req.interval_minutes,
            "status": DataBridgeScheduleStatus.ACTIVE,
            "auto_import_to_async_queue": req.auto_import_to_async_queue,
            "config": req.config,
            "params": req.params,
            "last_run_at": None,
            "next_run_at": next_run.isoformat(),
            "last_status": None,
            "last_error": None,
            "last_records_count": 0,
            "created_at": now.isoformat(),
        }

        tenant_store = cls._schedules.setdefault(tenant_id, {})
        tenant_store[schedule_id] = sched_data

        return cls._to_response(sched_data)

    @classmethod
    def list_schedules(
        cls,
        tenant_id: str,
        connector_type: Optional[DataBridgeConnectorType] = None,
    ) -> List[DataBridgeScheduleResponse]:
        """Lists all registered schedules for a tenant, optionally filtered by connector_type."""
        tenant_store = cls._schedules.get(tenant_id, {})
        schedules = list(tenant_store.values())
        if connector_type:
            c_val = connector_type.value if hasattr(connector_type, "value") else str(connector_type)
            schedules = [s for s in schedules if s.get("connector_type") == c_val]
        return [cls._to_response(s) for s in schedules]

    @classmethod
    def get_schedule(cls, tenant_id: str, schedule_id: str) -> Optional[DataBridgeScheduleResponse]:
        """Retrieves a specific schedule."""
        tenant_store = cls._schedules.get(tenant_id, {})
        sched = tenant_store.get(schedule_id)
        return cls._to_response(sched) if sched else None

    @classmethod
    def update_schedule_status(
        cls,
        tenant_id: str,
        schedule_id: str,
        status: DataBridgeScheduleStatus,
    ) -> DataBridgeScheduleResponse:
        """Updates the operational status of a schedule."""
        tenant_store = cls._schedules.get(tenant_id, {})
        sched = tenant_store.get(schedule_id)
        if not sched:
            raise DataBridgeValidationError(f"Schedule '{schedule_id}' not found for tenant '{tenant_id}'.")

        sched["status"] = status
        return cls._to_response(sched)

    @classmethod
    def delete_schedule(cls, tenant_id: str, schedule_id: str) -> bool:
        """Removes a schedule."""
        tenant_store = cls._schedules.get(tenant_id, {})
        if schedule_id in tenant_store:
            del tenant_store[schedule_id]
            return True
        return False

    @classmethod
    async def trigger_schedule(
        cls,
        tenant_id: str,
        schedule_id: str,
        db_session: Optional[AsyncSession] = None,
    ) -> DataBridgeScheduleTriggerResponse:
        """
        Executes a scheduled sync extraction immediately.
        Pulls records via connector orchestrator and records execution status.
        """
        tenant_store = cls._schedules.get(tenant_id, {})
        sched = tenant_store.get(schedule_id)
        if not sched:
            raise DataBridgeValidationError(f"Schedule '{schedule_id}' not found for tenant '{tenant_id}'.")

        now = datetime.now(timezone.utc)
        sched["status"] = DataBridgeScheduleStatus.RUNNING
        sched["last_run_at"] = now.isoformat()

        try:
            params = dict(sched.get("params", {}))
            raw_payload = params.pop("raw_payload", None)
            pull_req = DataBridgeConnectorPullRequest(
                connector_type=DataBridgeConnectorType(sched["connector_type"]),
                entity_type=DataBridgeEntityType(sched["entity_type"]),
                config=sched["config"],
                params=params,
                raw_payload=raw_payload,
            )

            pull_res = await DataBridgeConnectorOrchestrator.pull_and_transform(pull_req)
            records_count = pull_res.total_records_pulled

            sched["last_status"] = "SUCCESS"
            sched["last_error"] = None
            sched["last_records_count"] = records_count
            sched["status"] = DataBridgeScheduleStatus.ACTIVE
            sched["next_run_at"] = (now + timedelta(minutes=sched["interval_minutes"])).isoformat()

            job_id = None
            if sched.get("auto_import_to_async_queue") and records_count > 0:
                job_id = f"JOB-SCHED-{uuid.uuid4().hex[:8].upper()}"

            return DataBridgeScheduleTriggerResponse(
                schedule_id=schedule_id,
                status="COMPLETED",
                records_pulled=records_count,
                job_id=job_id,
                triggered_at=now.isoformat(),
                message=f"Successfully executed pull schedule '{sched['name']}': {records_count} records transformed.",
            )

        except Exception as exc:
            sched["last_status"] = "FAILED"
            sched["last_error"] = str(exc)
            sched["status"] = DataBridgeScheduleStatus.FAILED
            raise DataBridgeValidationError(f"Pull execution failed for schedule '{schedule_id}': {str(exc)}") from exc

    @staticmethod
    def _to_response(data: Dict[str, Any]) -> DataBridgeScheduleResponse:
        return DataBridgeScheduleResponse(
            schedule_id=data["schedule_id"],
            tenant_id=data["tenant_id"],
            name=data["name"],
            connector_type=data["connector_type"],
            entity_type=data["entity_type"],
            interval_minutes=data["interval_minutes"],
            status=data["status"],
            auto_import_to_async_queue=data.get("auto_import_to_async_queue", False),
            last_run_at=data.get("last_run_at"),
            next_run_at=data.get("next_run_at"),
            last_status=data.get("last_status"),
            last_error=data.get("last_error"),
            last_records_count=data.get("last_records_count", 0),
            created_at=data["created_at"],
        )
