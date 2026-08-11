"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Description  : Master Exchange Hub Service Layer governing explicit PUBLISH and FETCH operations,
               payload sanitation, company policy enforcement, versioning, mapping, and audit logging.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master_hub import (
    MasterHubType,
    MasterHubRecord,
    MasterHubVersion,
    MasterHubPublication,
    MasterHubImport,
    MasterHubMapping,
    MasterHubCompanyPolicy,
    MasterHubAuditEvent,
)
from app.services.control_database_registry import ControlDatabaseRegistryService

logger = logging.getLogger(__name__)

# List of prohibited operational & financial keys that MUST NEVER be published to Master Hub
PROHIBITED_OPERATIONAL_KEYS = {
    "price", "cost_price", "selling_price", "mrp_value", "total_amount",
    "stock", "reserved_stock", "available_stock", "on_hand_qty",
    "outstanding", "outstanding_balance", "unallocated_credits", "credit_limit",
    "journal_entries", "ledger", "balance_due", "purchase_history", "sales_history",
}


class MasterHubExchangeService:
    """
    Master Exchange Hub Service executing explicit PUBLISH, FETCH, and versioning workflows.
    Enforces mandatory security authorization via Control DB and sanitizes payloads.
    """

    @staticmethod
    def sanitize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Safeguard 3: Strips operational and financial fields (price, cost, stock, ledger balances).
        Returns a clean master payload copy containing only immutable identity & metadata.
        """
        clean_data = {}
        for key, value in payload.items():
            if key.lower() in PROHIBITED_OPERATIONAL_KEYS:
                continue
            clean_data[key] = value
        return clean_data

    @staticmethod
    async def _log_audit_event(
        hub_db: AsyncSession,
        actor_user_id: str,
        actor_username: str,
        operation: str,
        master_type: str,
        source_company_id: Optional[str] = None,
        source_company_code: Optional[str] = None,
        target_company_id: Optional[str] = None,
        target_company_code: Optional[str] = None,
        hub_master_id: Optional[str] = None,
        version: Optional[int] = None,
        result: str = "SUCCESS",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MasterHubAuditEvent:
        """
        Immutable audit logging helper.
        """
        audit = MasterHubAuditEvent(
            actor_user_id=actor_user_id,
            actor_username=actor_username,
            operation=operation,
            master_type=master_type,
            source_company_id=source_company_id,
            source_company_code=source_company_code,
            target_company_id=target_company_id,
            target_company_code=target_company_code,
            hub_master_id=hub_master_id,
            version=version,
            result=result,
            metadata_json=metadata or {},
        )
        hub_db.add(audit)
        await hub_db.flush()
        return audit

    @classmethod
    async def publish_master(
        cls,
        control_db: AsyncSession,
        hub_db: AsyncSession,
        user_id: str,
        username: str,
        company_code: str,
        master_type: str,
        source_record_id: str,
        raw_payload: Dict[str, Any],
    ) -> MasterHubRecord:
        """
        Explicitly publishes a local Company DB master record to the Master Exchange Hub.
        """
        # Safeguard 4: Security Authorization via Control DB
        has_access = await ControlDatabaseRegistryService.verify_user_company_access(
            control_db, user_id, company_code
        )
        if not has_access:
            await cls._log_audit_event(
                hub_db, user_id, username, "PUBLISH", master_type,
                source_company_code=company_code, result="DENIED", metadata={"reason": "User not assigned to company"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User is not assigned to company '{company_code}'."
            )

        assigned_company = await ControlDatabaseRegistryService.get_company_database(
            control_db, company_code
        )
        if not assigned_company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company '{company_code}' is not registered in Control DB."
            )

        # Check MasterType Registry Policy
        type_res = await hub_db.execute(select(MasterHubType).where(MasterHubType.master_type == master_type))
        type_cfg = type_res.scalars().first()

        if not type_cfg or not type_cfg.enabled or not type_cfg.publish_allowed:
            await cls._log_audit_event(
                hub_db, user_id, username, "PUBLISH", master_type,
                source_company_id=assigned_company.company_id, source_company_code=company_code,
                result="DENIED", metadata={"reason": "MasterType publish prohibited"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Master type '{master_type}' is prohibited from publishing by platform registry policy."
            )

        # Safeguard 5: Company Level Policy Check
        pol_res = await hub_db.execute(
            select(MasterHubCompanyPolicy).where(
                and_(
                    MasterHubCompanyPolicy.company_id == assigned_company.company_id,
                    MasterHubCompanyPolicy.master_type == master_type,
                )
            )
        )
        comp_pol = pol_res.scalars().first()

        if comp_pol and not comp_pol.publish_enabled:
            await cls._log_audit_event(
                hub_db, user_id, username, "PUBLISH", master_type,
                source_company_id=assigned_company.company_id, source_company_code=company_code,
                result="DENIED", metadata={"reason": "Company policy publish_enabled=False"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Publishing master type '{master_type}' is disabled by Company '{company_code}' policy."
            )

        # Safeguard 3: Sanitize payload to strip operational & financial data
        clean_payload = cls.sanitize_payload(raw_payload)

        # Compute payload checksum
        payload_bytes = json.dumps(clean_payload, sort_keys=True).encode("utf-8")
        checksum = hashlib.sha256(payload_bytes).hexdigest()

        # Check if record already exists in Hub
        rec_res = await hub_db.execute(
            select(MasterHubRecord).where(
                and_(
                    MasterHubRecord.source_company_id == assigned_company.company_id,
                    MasterHubRecord.master_type == master_type,
                    MasterHubRecord.source_record_id == source_record_id,
                )
            )
        )
        hub_record = rec_res.scalars().first()

        if hub_record:
            if hub_record.status == "DEPRECATED":
                await cls._log_audit_event(
                    hub_db, user_id, username, "PUBLISH", master_type,
                    source_company_id=assigned_company.company_id, source_company_code=company_code,
                    hub_master_id=hub_record.id, result="DENIED", metadata={"reason": "Cannot publish deprecated record"}
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot publish a new version for a DEPRECATED master record."
                )

            # Update existing record version
            hub_record.latest_version += 1
            hub_record.published_at = datetime.now(timezone.utc)
            hub_record.published_by = username
            version_num = hub_record.latest_version
        else:
            # Create new MasterHubRecord
            version_num = 1
            hub_record = MasterHubRecord(
                master_type=master_type,
                source_company_id=assigned_company.company_id,
                source_company_code=company_code,
                source_record_id=source_record_id,
                latest_version=version_num,
                status="PUBLISHED",
                published_by=username,
            )
            hub_db.add(hub_record)
            await hub_db.flush()

        # Add Version Record
        hub_version = MasterHubVersion(
            hub_master_id=hub_record.id,
            version=version_num,
            payload_json=clean_payload,
            checksum=checksum,
            published_by=username,
        )
        hub_db.add(hub_version)

        # Add Publication Log
        pub_log = MasterHubPublication(
            source_company_id=assigned_company.company_id,
            source_company_code=company_code,
            master_type=master_type,
            source_record_id=source_record_id,
            hub_master_id=hub_record.id,
            version=version_num,
            status="PUBLISHED",
            published_by=username,
        )
        hub_db.add(pub_log)

        # Register mapping for source company
        map_res = await hub_db.execute(
            select(MasterHubMapping).where(
                and_(
                    MasterHubMapping.company_id == assigned_company.company_id,
                    MasterHubMapping.hub_master_id == hub_record.id,
                )
            )
        )
        existing_map = map_res.scalars().first()

        if not existing_map:
            mapping = MasterHubMapping(
                hub_master_id=hub_record.id,
                company_id=assigned_company.company_id,
                company_code=company_code,
                local_record_id=source_record_id,
                master_type=master_type,
                version=version_num,
                status="ACTIVE",
            )
            hub_db.add(mapping)
        else:
            existing_map.version = version_num

        # Log Audit Event
        await cls._log_audit_event(
            hub_db, user_id, username, "PUBLISH", master_type,
            source_company_id=assigned_company.company_id, source_company_code=company_code,
            hub_master_id=hub_record.id, version=version_num, result="SUCCESS"
        )

        await hub_db.commit()
        return hub_record

    @classmethod
    async def fetch_master(
        cls,
        control_db: AsyncSession,
        hub_db: AsyncSession,
        user_id: str,
        username: str,
        company_code: str,
        hub_master_id: str,
        local_record_id: str,
    ) -> Dict[str, Any]:
        """
        Explicitly fetches a published master representation from the Hub into a target Company DB context.
        """
        # Safeguard 4: Security Authorization via Control DB
        has_access = await ControlDatabaseRegistryService.verify_user_company_access(
            control_db, user_id, company_code
        )
        if not has_access:
            await cls._log_audit_event(
                hub_db, user_id, username, "FETCH", master_type="UNKNOWN",
                target_company_code=company_code, hub_master_id=hub_master_id,
                result="DENIED", metadata={"reason": "User not assigned to company"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User is not assigned to company '{company_code}'."
            )

        assigned_company = await ControlDatabaseRegistryService.get_company_database(
            control_db, company_code
        )
        if not assigned_company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company '{company_code}' is not registered in Control DB."
            )

        # Retrieve Hub Record
        rec_res = await hub_db.execute(select(MasterHubRecord).where(MasterHubRecord.id == hub_master_id))
        hub_record = rec_res.scalars().first()

        if not hub_record or hub_record.status != "PUBLISHED":
            await cls._log_audit_event(
                hub_db, user_id, username, "FETCH", master_type="UNKNOWN",
                target_company_id=assigned_company.company_id, target_company_code=company_code,
                hub_master_id=hub_master_id, result="DENIED", metadata={"reason": "Hub record not found or not published"}
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master record '{hub_master_id}' is not available for fetch."
            )

        master_type = hub_record.master_type

        # Check MasterType Registry Policy
        type_res = await hub_db.execute(select(MasterHubType).where(MasterHubType.master_type == master_type))
        type_cfg = type_res.scalars().first()

        if not type_cfg or not type_cfg.enabled or not type_cfg.fetch_allowed:
            await cls._log_audit_event(
                hub_db, user_id, username, "FETCH", master_type,
                target_company_id=assigned_company.company_id, target_company_code=company_code,
                hub_master_id=hub_master_id, result="DENIED", metadata={"reason": "MasterType fetch prohibited"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Master type '{master_type}' is prohibited from fetching by platform registry policy."
            )

        # Safeguard 5: Company Level Policy Check
        pol_res = await hub_db.execute(
            select(MasterHubCompanyPolicy).where(
                and_(
                    MasterHubCompanyPolicy.company_id == assigned_company.company_id,
                    MasterHubCompanyPolicy.master_type == master_type,
                )
            )
        )
        comp_pol = pol_res.scalars().first()

        if comp_pol and not comp_pol.fetch_enabled:
            await cls._log_audit_event(
                hub_db, user_id, username, "FETCH", master_type,
                target_company_id=assigned_company.company_id, target_company_code=company_code,
                hub_master_id=hub_master_id, result="DENIED", metadata={"reason": "Company policy fetch_enabled=False"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Fetching master type '{master_type}' is disabled by Company '{company_code}' policy."
            )

        # Retrieve Latest Version Payload
        ver_res = await hub_db.execute(
            select(MasterHubVersion).where(
                and_(
                    MasterHubVersion.hub_master_id == hub_master_id,
                    MasterHubVersion.version == hub_record.latest_version,
                )
            )
        )
        latest_ver = ver_res.scalars().first()

        if not latest_ver:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Version payload '{hub_record.latest_version}' missing for Hub record '{hub_master_id}'."
            )

        # Register or Update MasterHubImport record
        imp_res = await hub_db.execute(
            select(MasterHubImport).where(
                and_(
                    MasterHubImport.target_company_id == assigned_company.company_id,
                    MasterHubImport.hub_master_id == hub_master_id,
                )
            )
        )
        imp_rec = imp_res.scalars().first()

        if not imp_rec:
            imp_rec = MasterHubImport(
                target_company_id=assigned_company.company_id,
                target_company_code=company_code,
                hub_master_id=hub_master_id,
                version_imported=hub_record.latest_version,
                local_record_id=local_record_id,
                import_status="ACCEPTED",
                update_status="UP_TO_DATE",
                imported_by=username,
            )
            hub_db.add(imp_rec)
        else:
            imp_rec.version_imported = hub_record.latest_version
            imp_rec.local_record_id = local_record_id
            imp_rec.import_status = "ACCEPTED"
            imp_rec.update_status = "UP_TO_DATE"
            imp_rec.imported_at = datetime.now(timezone.utc)

        # Register MasterHubMapping relationship link
        map_res = await hub_db.execute(
            select(MasterHubMapping).where(
                and_(
                    MasterHubMapping.company_id == assigned_company.company_id,
                    MasterHubMapping.hub_master_id == hub_master_id,
                )
            )
        )
        map_rec = map_res.scalars().first()

        if not map_rec:
            map_rec = MasterHubMapping(
                hub_master_id=hub_master_id,
                company_id=assigned_company.company_id,
                company_code=company_code,
                local_record_id=local_record_id,
                master_type=master_type,
                version=hub_record.latest_version,
                status="ACTIVE",
            )
            hub_db.add(map_rec)
        else:
            map_rec.local_record_id = local_record_id
            map_rec.version = hub_record.latest_version

        # Audit Event
        await cls._log_audit_event(
            hub_db, user_id, username, "FETCH", master_type,
            source_company_id=hub_record.source_company_id, source_company_code=hub_record.source_company_code,
            target_company_id=assigned_company.company_id, target_company_code=company_code,
            hub_master_id=hub_master_id, version=hub_record.latest_version, result="SUCCESS"
        )

        await hub_db.commit()

        # Return sanitized payload for local Company DB record initialization
        return {
            "hub_master_id": hub_record.id,
            "master_type": master_type,
            "version": latest_ver.version,
            "payload": latest_ver.payload_json,
            "checksum": latest_ver.checksum,
        }

    @classmethod
    async def check_for_updates(
        cls,
        hub_db: AsyncSession,
        company_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Safeguard 2: Checks if any imported Hub records have new versions available.
        Returns notification list of available updates (`UPDATE_AVAILABLE`).
        NEVER mutates local Company DB records.
        """
        imports_res = await hub_db.execute(
            select(MasterHubImport).where(
                and_(
                    MasterHubImport.target_company_id == company_id,
                    MasterHubImport.import_status == "ACCEPTED",
                )
            )
        )
        imports = imports_res.scalars().all()
        updates = []

        for imp in imports:
            rec_res = await hub_db.execute(select(MasterHubRecord).where(MasterHubRecord.id == imp.hub_master_id))
            rec = rec_res.scalars().first()
            if rec and rec.status == "PUBLISHED" and rec.latest_version > imp.version_imported:
                imp.update_status = "UPDATE_AVAILABLE"
                updates.append({
                    "hub_master_id": rec.id,
                    "master_type": rec.master_type,
                    "local_record_id": imp.local_record_id,
                    "version_imported": imp.version_imported,
                    "latest_version": rec.latest_version,
                    "status": "UPDATE_AVAILABLE",
                })
        await hub_db.commit()
        return updates

    @classmethod
    async def deprecate_master(
        cls,
        control_db: AsyncSession,
        hub_db: AsyncSession,
        user_id: str,
        username: str,
        company_code: str,
        hub_master_id: str,
    ) -> MasterHubRecord:
        """
        Deprecates a Hub record. Only the originating source company user may deprecate.
        """
        has_access = await ControlDatabaseRegistryService.verify_user_company_access(
            control_db, user_id, company_code
        )
        if not has_access:
            await cls._log_audit_event(
                hub_db, user_id, username, "DEPRECATE", master_type="UNKNOWN",
                source_company_code=company_code, hub_master_id=hub_master_id,
                result="DENIED", metadata={"reason": "User not assigned to company"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User is not assigned to company '{company_code}'."
            )

        assigned_company = await ControlDatabaseRegistryService.get_company_database(
            control_db, company_code
        )
        if not assigned_company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company '{company_code}' is not registered in Control DB."
            )

        rec_res = await hub_db.execute(select(MasterHubRecord).where(MasterHubRecord.id == hub_master_id))
        rec = rec_res.scalars().first()

        if not rec:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hub record not found.")

        # Source Company Ownership Guard
        if rec.source_company_id != assigned_company.company_id:
            await cls._log_audit_event(
                hub_db, user_id, username, "DEPRECATE", rec.master_type,
                source_company_id=assigned_company.company_id, source_company_code=company_code,
                hub_master_id=hub_master_id, result="DENIED", metadata={"reason": "User is not source company owner"}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the originating source company may deprecate a published Master Hub record."
            )

        rec.status = "DEPRECATED"
        await cls._log_audit_event(
            hub_db, user_id, username, "DEPRECATE", rec.master_type,
            source_company_id=assigned_company.company_id, source_company_code=company_code,
            hub_master_id=hub_master_id, version=rec.latest_version, result="SUCCESS"
        )
        await hub_db.commit()
        return rec
