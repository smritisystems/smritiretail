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
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
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
        terminal_id = getattr(data, "terminalId", None) or getattr(data, "terminal_id", "COMMON") or "COMMON"
        is_common = getattr(data, "isCommonAcrossTerminals", None)
        if is_common is None:
            is_common = getattr(data, "is_common_across_terminals", True)
        if is_common is None:
            is_common = True
        tx_group = getattr(data, "transactionGroup", None) or getattr(data, "transaction_group", "SALES") or "SALES"
        start_num = getattr(data, "startNumber", None) or getattr(data, "start_number", 1) or 1
        is_void = getattr(data, "isVoidUnified", None) or getattr(data, "is_void_unified", False) or False

        company_id_val = getattr(data, "company_id", None) or getattr(data, "companyId", None)

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
            company_id=company_id_val,
            company_code=data.companyCode,
            mode=data.mode or "Auto",
            description=data.description,
            terminal_id=terminal_id,
            is_common_across_terminals=is_common,
            transaction_group=tx_group,
            start_number=start_num,
            is_void_unified=is_void,
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
        if hasattr(data, "terminalId") and data.terminalId is not None: series.terminal_id = data.terminalId
        if hasattr(data, "isCommonAcrossTerminals") and data.isCommonAcrossTerminals is not None: series.is_common_across_terminals = data.isCommonAcrossTerminals
        if hasattr(data, "transactionGroup") and data.transactionGroup is not None: series.transaction_group = data.transactionGroup
        if hasattr(data, "startNumber") and data.startNumber is not None: series.start_number = data.startNumber
        if hasattr(data, "isVoidUnified") and data.isVoidUnified is not None: series.is_void_unified = data.isVoidUnified
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

    # =========================================================================
    # Shoper 9 Bill Prefix Resolution, Validation & Lifecycle Engine
    # =========================================================================

    @staticmethod
    def validate_gst_rule_46b(prefix: str, doc_no: int | str, suffix: str = "") -> dict:
        """
        Validates statutory GST Rule 46(b) compliance:
        - Consecutive serial number not exceeding 16 characters
        - Permitted characters: [A-Za-z0-9/-]
        - Unique for financial year
        """
        import re
        pfx = prefix or ""
        sfx = suffix or ""
        combined = f"{pfx}{doc_no}{sfx}"
        length = len(combined)
        pattern = r"^[A-Za-z0-9/\-]+$"
        is_valid_chars = bool(re.match(pattern, combined)) if combined else True
        is_valid_len = length <= 16
        is_valid = is_valid_chars and is_valid_len
        error_msg = None
        if not is_valid_len:
            error_msg = f"Statutory GST Rule 46(b) violation: Serial number '{combined}' ({length} chars) exceeds maximum 16 characters."
        elif not is_valid_chars:
            error_msg = f"Statutory GST Rule 46(b) violation: Serial number '{combined}' contains invalid characters (only A-Z, 0-9, '/', '-' permitted)."
        return {
            "isValid": is_valid,
            "combined": combined,
            "length": length,
            "error": error_msg
        }

    async def resolve_bill_prefix(
        self,
        company_id: Optional[str],
        branch_id: Optional[str],
        terminal_id: str,
        transaction_type: str,
        bill_type: str = "Product"
    ) -> dict:
        """
        Resolves the authoritative Bill Prefix for a POS terminal given transaction type.
        Resolution hierarchy:
          1. Terminal-specific series (terminal_id == requested_terminal, is_common_across_terminals == False)
          2. Common store series (terminal_id == 'COMMON' or is_common_across_terminals == True)
          3. Fallback / auto-instantiated default
        """
        from sqlalchemy import or_, and_
        clean_tx = (transaction_type or "SALES_CASH").strip().upper()
        clean_term = (terminal_id or "COMMON").strip().upper()

        tx_type_mapping = {
            "CASH": ("SALES_CASH", "SALES", "INV/C/"),
            "SALES_CASH": ("SALES_CASH", "SALES", "INV/C/"),
            "CREDIT": ("SALES_CREDIT", "SALES", "INV/CR/"),
            "SALES_CREDIT": ("SALES_CREDIT", "SALES", "INV/CR/"),
            "RETURN": ("SALES_RETURN", "SALES", "RET/"),
            "SALES_RETURN": ("SALES_RETURN", "SALES", "RET/"),
            "VOID": ("VOID_SALES", "SALES", "VOID/"),
            "VOID_SALES": ("VOID_SALES", "SALES", "VOID/"),
            "BILL_HOLD": ("BILL_HOLD", "SLIPS", "HOLD/"),
            "HOLD": ("BILL_HOLD", "SLIPS", "HOLD/"),
            "SALES_ORDER": ("SALES_ORDER", "SLIPS", "SO/"),
            "ORDER": ("SALES_ORDER", "SLIPS", "SO/"),
            "SALES_ADVICE_SLIP": ("SALES_ADVICE_SLIP", "SLIPS", "SAS/"),
            "SAS": ("SALES_ADVICE_SLIP", "SLIPS", "SAS/"),
            "SERVICE_ORDER": ("SERVICE_ORDER", "SLIPS", "SVO/"),
            "DELIVERY_CHALLAN": ("DELIVERY_CHALLAN", "SLIPS", "DC/"),
            "DC": ("DELIVERY_CHALLAN", "SLIPS", "DC/"),
            "APPROVAL_DC": ("APPROVAL_DC", "SLIPS", "ADC/"),
            "CASH_RECEIPT": ("CASH_RECEIPT", "CASH", "RCP/"),
            "CASH_PAYOUT": ("CASH_PAYOUT", "CASH", "PAY/"),
        }

        canonical_doc_type, tx_group, default_pfx = tx_type_mapping.get(
            clean_tx, (clean_tx, "SALES", f"{clean_tx[:3]}/")
        )

        filters = [
            DocumentSeries.is_deleted == False,
            DocumentSeries.is_active == True,
            DocumentSeries.document_type == canonical_doc_type,
        ]
        if company_id:
            filters.append(
                or_(
                    DocumentSeries.company_id == company_id,
                    DocumentSeries.company_code == company_id
                )
            )

        # 1. Try terminal-specific
        q_term = select(DocumentSeries).where(
            *filters,
            DocumentSeries.terminal_id == clean_term,
            DocumentSeries.is_common_across_terminals == False
        )
        res = await self.db.execute(q_term)
        series = res.scalars().first()

        # 2. Try common store
        if not series:
            q_common = select(DocumentSeries).where(
                *filters,
                or_(
                    DocumentSeries.terminal_id == "COMMON",
                    DocumentSeries.is_common_across_terminals == True
                )
            )
            res = await self.db.execute(q_common)
            series = res.scalars().first()

        # 3. Fallback to generic SALES_INVOICE if not found and is a sales invoice
        if not series and canonical_doc_type in ("SALES_CASH", "SALES_CREDIT"):
            q_generic = select(DocumentSeries).where(
                DocumentSeries.is_deleted == False,
                DocumentSeries.is_active == True,
                DocumentSeries.document_type == "SALES_INVOICE"
            )
            res = await self.db.execute(q_generic)
            series = res.scalars().first()

        # 4. Auto-instantiate default if still missing
        if not series:
            now = datetime.now(timezone.utc)
            fy_year = now.year if now.month >= 4 else now.year - 1
            fy_str = f"{fy_year}-{fy_year + 1}"
            fy_suffix = f"{str(fy_year)[-2:]}-{str(fy_year + 1)[-2:]}"

            new_id = f"SER-AUTO-{uuid.uuid4().hex[:8]}"
            series = DocumentSeries(
                id=new_id,
                name=f"Standard {canonical_doc_type.replace('_', ' ').title()}",
                document_type=canonical_doc_type,
                transaction_group=tx_group,
                terminal_id="COMMON",
                is_common_across_terminals=True,
                module="Sales" if tx_group == "SALES" else ("Cash" if tx_group == "CASH" else "Slips"),
                prefix=default_pfx,
                suffix=f"{fy_suffix}/",
                running_length=4,
                start_number=1,
                current_number=0,
                reset_rule="Financial Year",
                financial_year=fy_str,
                company_code=company_id or "SMRITI",
                mode="Auto",
                is_active=True,
                created_by="SYSTEM",
                updated_by="SYSTEM"
            )
            self.db.add(series)
            await self.db.commit()
            await self.db.refresh(series)

        # Calculate next doc number preview
        start_num = series.start_number or 1
        curr_num = series.current_number or 0
        next_num = max(curr_num + 1, start_num) if curr_num > 0 else start_num
        run_len = series.running_length or 4
        formatted_seq = str(next_num).zfill(run_len)

        full_preview = f"{series.prefix or ''}{formatted_seq}{series.suffix or ''}"
        gst_validation = self.validate_gst_rule_46b(series.prefix, formatted_seq, series.suffix)

        return {
            "seriesId": series.id,
            "prefix": series.prefix or "",
            "suffix": series.suffix or "",
            "nextDocNo": next_num,
            "formattedDocNo": formatted_seq,
            "fullPreview": full_preview,
            "runningLength": run_len,
            "terminalId": series.terminal_id or "COMMON",
            "isCommonAcrossTerminals": series.is_common_across_terminals if series.is_common_across_terminals is not None else True,
            "gstRule46bValid": gst_validation["isValid"],
            "gstRule46bLength": gst_validation["length"],
            "validationMessage": gst_validation["error"]
        }

    async def list_bill_prefixes(
        self,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        transaction_group: Optional[str] = None,
        terminal_id: Optional[str] = None
    ) -> list[DocumentSeries]:
        from sqlalchemy import or_
        q = select(DocumentSeries).where(DocumentSeries.is_deleted == False)
        if company_id:
            q = q.where(
                or_(
                    DocumentSeries.company_id == company_id,
                    DocumentSeries.company_code == company_id
                )
            )
        if transaction_group:
            q = q.where(DocumentSeries.transaction_group == transaction_group)
        if terminal_id:
            q = q.where(
                or_(
                    DocumentSeries.terminal_id == terminal_id,
                    DocumentSeries.terminal_id == "COMMON",
                    DocumentSeries.is_common_across_terminals == True
                )
            )
        q = q.order_by(DocumentSeries.transaction_group, DocumentSeries.document_type, DocumentSeries.terminal_id)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def save_bill_prefixes_batch(
        self,
        company_id: Optional[str],
        branch_id: Optional[str],
        req,
        operator: str
    ) -> list[DocumentSeries]:
        results = []
        for item in req.items:
            # Check GST Rule 46(b)
            pfx = item.prefix or ""
            sfx = item.suffix or ""
            padded_sample = str(item.startNumber or 1).zfill(item.runningLength or 4)
            gst_res = self.validate_gst_rule_46b(pfx, padded_sample, sfx)
            if not gst_res["isValid"]:
                raise HTTPException(status_code=400, detail=gst_res["error"])

            if item.id:
                existing = await self.db.get(DocumentSeries, item.id)
                if existing and not existing.is_deleted:
                    existing.name = item.name
                    existing.document_type = item.documentType
                    existing.transaction_group = item.transactionGroup
                    existing.terminal_id = item.terminalId or "COMMON"
                    existing.is_common_across_terminals = item.isCommonAcrossTerminals
                    existing.prefix = item.prefix
                    existing.suffix = item.suffix or ""
                    existing.start_number = item.startNumber
                    existing.running_length = item.runningLength
                    existing.is_active = item.isActive
                    existing.is_void_unified = item.isVoidUnified
                    existing.updated_by = operator
                    existing.modified_at = datetime.now(timezone.utc)
                    results.append(existing)
                    continue

            # Create new series
            new_series = DocumentSeries(
                id=f"SER-{uuid.uuid4().hex[:8]}",
                company_id=company_id,
                branch_id=branch_id,
                name=item.name,
                document_type=item.documentType,
                transaction_group=item.transactionGroup,
                terminal_id=item.terminalId or "COMMON",
                is_common_across_terminals=item.isCommonAcrossTerminals,
                prefix=item.prefix,
                suffix=item.suffix or "",
                start_number=item.startNumber,
                current_number=item.currentNumber or 0,
                running_length=item.runningLength,
                is_active=item.isActive,
                is_void_unified=item.isVoidUnified,
                reset_rule="Financial Year",
                mode="Auto",
                created_by=operator,
                updated_by=operator
            )
            self.db.add(new_series)
            results.append(new_series)

        await self.db.commit()
        for r in results:
            await self.db.refresh(r)
        return results

    async def execute_year_end_rollover(
        self,
        company_id: Optional[str],
        req,
        operator: str
    ) -> dict:
        q = select(DocumentSeries).where(DocumentSeries.is_deleted == False, DocumentSeries.is_active == True)
        if company_id:
            from sqlalchemy import or_
            q = q.where(
                or_(
                    DocumentSeries.company_id == company_id,
                    DocumentSeries.company_code == company_id
                )
            )
        res = await self.db.execute(q)
        active_series = list(res.scalars().all())

        updated_list = []
        old_year = None
        for s in active_series:
            old_year = s.financial_year
            old_suffix = s.suffix or ""
            old_num = s.current_number

            # Update financial year
            s.financial_year = req.newFinancialYear

            # Update year suffix: e.g. replace any 2-digit or 4-digit year pattern or set to newYearSuffix
            if req.newYearSuffix:
                s.suffix = req.newYearSuffix if not s.suffix else s.suffix.replace(old_suffix, req.newYearSuffix) if old_suffix in s.suffix else f"{req.newYearSuffix}/"

            # Reset counter if requested
            if req.resetToStartNumber:
                s.current_number = (s.start_number or 1) - 1

            s.updated_by = operator
            s.modified_at = datetime.now(timezone.utc)

            # Audit log
            log = NumberingAuditLog(
                id=f"NAL-{uuid.uuid4().hex[:8]}",
                series_id=s.id,
                series_name=s.name,
                action="RESET",
                document_no=f"YEAR_END_ROLLOVER_{req.newFinancialYear}",
                old_value=f"FY: {old_year}, Suffix: {old_suffix}, Num: {old_num}",
                new_value=f"FY: {s.financial_year}, Suffix: {s.suffix}, Num: {s.current_number}",
                details=f"Supervisory Year End Process executed by {operator}. Rollover to FY {req.newFinancialYear}.",
                operator=operator
            )
            self.db.add(log)
            updated_list.append({
                "id": s.id,
                "name": s.name,
                "documentType": s.document_type,
                "oldSuffix": old_suffix,
                "newSuffix": s.suffix,
                "resetNumber": s.current_number
            })

        await self.db.commit()
        return {
            "success": True,
            "seriesUpdated": len(updated_list),
            "oldYear": old_year,
            "newYear": req.newFinancialYear,
            "updatedSeries": updated_list
        }
