"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from ..models.numbering import DocumentSeries, NumberingAuditLog


class NumberingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_series(self) -> list[DocumentSeries]:
        q = select(DocumentSeries).where(DocumentSeries.is_deleted == False)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def get_series(self, company_code: str, document_type: str) -> DocumentSeries | None:
        q = (
            select(DocumentSeries)
            .where(
                DocumentSeries.company_code == company_code,
                DocumentSeries.document_type == document_type,
                DocumentSeries.is_deleted == False,
            )
        )
        res = await self.db.execute(q)
        return res.scalars().first()

    async def create_series(self, data, creator: str, commit: bool = True) -> DocumentSeries:
        new_id = f"SER-{uuid.uuid4().hex[:8]}"
        series = DocumentSeries(
            id=new_id,
            name=data.name,
            document_type=data.documentType,
            module=data.module,
            prefix=data.prefix or "",
            suffix=data.suffix or "",
            running_length=data.runningLength or 6,
            reset_rule=data.resetRule or "Financial Year",
            current_number=data.currentNumber or 0,
            financial_year=data.financialYear,
            company_code=data.companyCode,
            mode=data.mode or "Auto",
            description=data.description,
            created_by=creator,
            updated_by=creator
        )
        self.db.add(series)
        
        log = NumberingAuditLog(
            id=f"NAL-{uuid.uuid4().hex[:8]}",
            series_id=series.id,
            series_name=series.name,
            action="CREATE",
            document_no="-",
            old_value="-",
            new_value=str(series.current_number),
            details=f"Created new Document Series '{series.name}' for {series.document_type}",
            operator=creator
        )
        self.db.add(log)
        
        if commit:
            await self.db.commit()
        else:
            await self.db.flush()
        await self.db.refresh(series)
        return series

    async def update_series(self, series_id: str, data, updater: str) -> DocumentSeries:
        series = await self.db.get(DocumentSeries, series_id)
        if not series or series.is_deleted:
            raise HTTPException(status_code=404, detail="Series not found")

        old_val_str = f"currentNumber: {series.current_number}, resetRule: {series.reset_rule}"

        if data.name is not None: series.name = data.name
        if data.prefix is not None: series.prefix = data.prefix
        if data.suffix is not None: series.suffix = data.suffix
        if data.runningLength is not None: series.running_length = data.runningLength
        if data.resetRule is not None: series.reset_rule = data.resetRule
        if data.currentNumber is not None: series.current_number = data.currentNumber
        if data.financialYear is not None: series.financial_year = data.financialYear
        if data.companyCode is not None: series.company_code = data.companyCode
        if data.mode is not None: series.mode = data.mode
        if data.description is not None: series.description = data.description
        series.updated_by = updater
        series.modified_at = datetime.now(timezone.utc)

        new_val_str = f"currentNumber: {series.current_number}, resetRule: {series.reset_rule}"

        log = NumberingAuditLog(
            id=f"NAL-{uuid.uuid4().hex[:8]}",
            series_id=series_id,
            series_name=series.name,
            action="UPDATE",
            document_no="-",
            old_value=old_val_str,
            new_value=new_val_str,
            details=f"Updated configuration parameters for series '{series.name}'",
            operator=updater
        )
        self.db.add(log)

        await self.db.commit()
        await self.db.refresh(series)
        return series

    async def delete_series(self, series_id: str, operator: str) -> None:
        series = await self.db.get(DocumentSeries, series_id)
        if not series or series.is_deleted:
            raise HTTPException(status_code=404, detail="Series not found")

        series.is_active = False
        series.is_deleted = True
        series.deleted_at = datetime.now(timezone.utc)
        series.deleted_by = operator

        log = NumberingAuditLog(
            id=f"NAL-{uuid.uuid4().hex[:8]}",
            series_id=series_id,
            series_name=series.name,
            action="RESET",
            document_no="-",
            old_value="Active",
            new_value="Retired",
            details=f"Retired/deactivated series '{series.name}'",
            operator=operator
        )
        self.db.add(log)
        await self.db.commit()

    async def list_audit_logs(self) -> list[NumberingAuditLog]:
        q = select(NumberingAuditLog).order_by(NumberingAuditLog.created_at.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def allocate_voucher_number(self, series_id: str, branch: str, fy: str, username: str) -> str:
        """
        Allocate next voucher sequence number atomically using FOR UPDATE lock on DocumentSeries.
        """
        # Execute FOR UPDATE query to lock this row in transaction
        q = select(DocumentSeries).where(DocumentSeries.id == series_id, DocumentSeries.is_deleted == False).with_for_update()
        res = await self.db.execute(q)
        series = res.scalars().first()
        if not series:
            raise HTTPException(status_code=404, detail="Document series configuration not found.")

        # Determine current date/keys for resets
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = str(now.month).zfill(2)
        current_day = str(now.day).zfill(2)

        current_key = "Never"
        if series.reset_rule == "Daily":
            current_key = f"{current_year}-{current_month}-{current_day}"
        elif series.reset_rule == "Monthly":
            current_key = f"{current_year}-{current_month}"
        elif series.reset_rule == "Financial Year":
            fy_year = current_year if now.month >= 4 else current_year - 1
            current_key = f"{fy_year}-{fy_year + 1}"
        elif series.reset_rule == "Calendar Year":
            current_key = str(current_year)

        # Trigger reset sequence if reset key changes
        if series.reset_rule != "Never":
            if not series.last_reset_key:
                series.last_reset_key = current_key
            elif series.last_reset_key != current_key:
                series.last_reset_key = current_key
                series.current_number = 0

        old_num = series.current_number
        next_num = old_num + 1
        series.current_number = next_num

        # Zero-pad number sequence
        formatted_num = str(next_num).zfill(series.running_length or 6)

        # Token replacement inside prefix
        pfx = series.prefix or ""
        pfx = pfx.replace("{FY}", fy)
        pfx = pfx.replace("{Branch}", branch)
        pfx = pfx.replace("{Store}", branch)
        pfx = pfx.replace("{Month}", current_month)
        pfx = pfx.replace("{Year}", str(current_year))
        pfx = pfx.replace("{Date}", current_day)
        pfx = pfx.replace("{User}", username)
        pfx = pfx.replace("{Module}", series.module or "")

        # Token replacement inside suffix
        sfx = series.suffix or ""
        sfx = sfx.replace("{FY}", fy)
        sfx = sfx.replace("{Branch}", branch)
        sfx = sfx.replace("{Store}", branch)
        sfx = sfx.replace("{Month}", current_month)
        sfx = sfx.replace("{Year}", str(current_year))
        sfx = sfx.replace("{Date}", current_day)
        sfx = sfx.replace("{User}", username)
        sfx = sfx.replace("{Module}", series.module or "")

        allocated_no = f"{pfx}{formatted_num}{sfx}"

        # Write to audit ledger
        log = NumberingAuditLog(
            id=f"NAL-{uuid.uuid4().hex[:8]}",
            series_id=series.id,
            series_name=series.name,
            action="ALLOCATE",
            document_no=allocated_no,
            old_value=str(old_num),
            new_value=str(next_num),
            details=f"Allocated serial sequence atomically for {series.document_type}",
            operator=username
        )
        self.db.add(log)
        
        await self.db.commit()
        return allocated_no
