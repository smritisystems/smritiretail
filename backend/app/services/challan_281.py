"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.52.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Statutory Compliance & Government Remittance Service
"""

import re
import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from fastapi import HTTPException

from ..models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from ..schemas.challan_281 import Challan281Create, Challan281Response
from .unified_ledger import UnifiedAccountingLedgerService
from .outbox_service import OutboxService


class Challan281Service:
    """
    Authoritative double-entry accounting and lifecycle service for
    Government Tax Deducted at Source (TDS) remittance via Challan ITNS 281.
    """

    @staticmethod
    def _serialize_meta(payload: Challan281Create, total_amount: Decimal) -> str:
        """Serializes Challan 281 audit metadata into a robust reversible token."""
        parts = [
            f"BSR={payload.bsr_code}",
            f"CHL={payload.challan_no}",
            f"DATE={payload.challan_date.isoformat()}",
            f"TENDER={payload.tender_date.isoformat() if payload.tender_date else ''}",
            f"SEC={payload.tds_section}",
            f"QTR={payload.quarter}",
            f"FY={payload.financial_year}",
            f"HEAD={payload.minor_head}",
            f"TAX={payload.tax_amount}",
            f"SUR={payload.surcharge}",
            f"CESS={payload.cess}",
            f"INT={payload.interest}",
            f"FEE={payload.fee}",
            f"PEN={payload.penalty}",
            f"TOT={total_amount}",
            f"BANK={payload.bank_name or ''}",
            f"REF={payload.cheque_dd_no or ''}",
            f"ACC={payload.bank_account_code}",
        ]
        if payload.linked_bill_ids:
            parts.append(f"BILLS={','.join(payload.linked_bill_ids)}")
        return f"__CHALLAN_281_META__|{'|'.join(parts)}__"

    @staticmethod
    def _deserialize_meta(narration: str) -> Dict[str, str]:
        """Extracts Challan 281 metadata fields from voucher narration token."""
        match = re.search(r"__CHALLAN_281_META__\|(.*?)(?:__|$)", narration or "")
        if not match:
            return {}
        token_str = match.group(1)
        res = {}
        for item in token_str.split("|"):
            if "=" in item:
                k, v = item.split("=", 1)
                res[k.strip()] = v.strip()
        return res

    @classmethod
    async def record_challan_281(
        cls,
        session: AsyncSession,
        company_id: str,
        payload: Challan281Create,
        branch_id: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Challan281Response:
        """
        Records government tax remittance via Challan ITNS 281.
        Posts balanced double-entry voucher:
          Debit  Account 2030 (TDS Payable)     [Tax + Surcharge + Cess]
          Debit  Account 5090 (Interest & Fees) [Interest + Fee + Penalty] (if > 0)
          Credit Account 1020 (Bank Account)    [Total Amount]
        """
        tax_comp = (
            Decimal(str(payload.tax_amount))
            + Decimal(str(payload.surcharge or 0))
            + Decimal(str(payload.cess or 0))
        ).quantize(Decimal("0.01"))

        statutory_charges = (
            Decimal(str(payload.interest or 0))
            + Decimal(str(payload.fee or 0))
            + Decimal(str(payload.penalty or 0))
        ).quantize(Decimal("0.01"))

        total_amount = (tax_comp + statutory_charges).quantize(Decimal("0.01"))
        if total_amount <= 0:
            raise HTTPException(status_code=400, detail="Challan 281 total remittance amount must be greater than zero.")

        # Resolve COA accounts
        acc_tds = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "2030")
        acc_bank = await UnifiedAccountingLedgerService.get_account_by_code(
            session, company_id, payload.bank_account_code or "1020"
        )
        acc_expense = None
        if statutory_charges > 0:
            acc_expense = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "5090")

        # Voucher Header
        voucher_no = f"JV-CHL281-{payload.quarter}-{payload.challan_no}-{uuid.uuid4().hex[:4].upper()}"
        meta_token = cls._serialize_meta(payload, total_amount)
        clean_narration = payload.narration or f"TDS Remittance Challan 281 Sec {payload.tds_section} {payload.quarter} {payload.financial_year}"
        full_narration = f"{clean_narration}\n{meta_token}"

        voucher = JournalVoucher(
            id=f"jv_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            voucher_no=voucher_no,
            voucher_type="TDS_CHALLAN_281",
            voucher_date=payload.challan_date,
            posting_date=datetime.now(timezone.utc),
            reference_doc_type="CHALLAN_281",
            reference_doc_id=payload.challan_no,
            reference_doc_no=payload.challan_no,
            narration=full_narration,
            currency="INR",
            exchange_rate=Decimal("1.000000"),
            total_debit=total_amount,
            total_credit=total_amount,
            is_posted=True,
            is_cancelled=False,
            created_by=created_by or "system",
        )
        session.add(voucher)
        await session.flush()

        # Line 1: Debit Account 2030 (Discharge TDS Liability)
        entry_tds = GeneralLedgerEntry(
            id=f"gle_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            voucher_id=voucher.id,
            account_id=acc_tds.id,
            entry_date=payload.challan_date,
            posting_date=datetime.now(timezone.utc),
            debit_amount=tax_comp,
            credit_amount=Decimal("0.00"),
            remarks=f"TDS Discharge Sec {payload.tds_section} Chl {payload.challan_no} BSR {payload.bsr_code}",
        )
        session.add(entry_tds)

        # Line 2: Debit Account 5090 (Interest / Late Filing Fee / Penalty) if any
        if statutory_charges > 0 and acc_expense:
            entry_charges = GeneralLedgerEntry(
                id=f"gle_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                voucher_id=voucher.id,
                account_id=acc_expense.id,
                entry_date=payload.challan_date,
                posting_date=datetime.now(timezone.utc),
                debit_amount=statutory_charges,
                credit_amount=Decimal("0.00"),
                remarks=f"TDS Late Fee/Interest Sec 201(1A)/234E Chl {payload.challan_no}",
            )
            session.add(entry_charges)

        # Line 3: Credit Bank Account 1020 (Cash Outflow)
        entry_bank = GeneralLedgerEntry(
            id=f"gle_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            voucher_id=voucher.id,
            account_id=acc_bank.id,
            entry_date=payload.challan_date,
            posting_date=datetime.now(timezone.utc),
            debit_amount=Decimal("0.00"),
            credit_amount=total_amount,
            remarks=f"Bank Remittance TDS Challan 281 via {payload.bank_name or 'Bank'}",
        )
        session.add(entry_bank)

        await session.flush()

        # Publish outbox audit event
        try:
            await OutboxService.publish(
                db=session,
                company_id=company_id,
                event_type="TDS_CHALLAN_281_RECORDED",
                payload={
                    "voucher_id": voucher.id,
                    "voucher_no": voucher.voucher_no,
                    "challan_no": payload.challan_no,
                    "bsr_code": payload.bsr_code,
                    "total_amount": float(total_amount),
                    "quarter": payload.quarter,
                    "financial_year": payload.financial_year,
                },
                source_service="Challan281Service",
            )
        except Exception:
            pass

        return cls._to_response(voucher)

    @classmethod
    async def cancel_challan_281(
        cls,
        session: AsyncSession,
        company_id: str,
        challan_identifier: str,
        reason: Optional[str] = None,
        cancelled_by: Optional[str] = None,
    ) -> Challan281Response:
        """
        Cancels a Challan 281 payment voucher and posts an exact symmetrical reversal:
          Debit  Account 1020 (Bank Account)    [Total Amount]
          Credit Account 2030 (TDS Payable)     [Tax + Surcharge + Cess]
          Credit Account 5090 (Interest & Fees) [Interest + Fee + Penalty] (if > 0)
        """
        stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.voucher_type == "TDS_CHALLAN_281",
            JournalVoucher.is_deleted == False,
            (JournalVoucher.id == challan_identifier)
            | (JournalVoucher.voucher_no == challan_identifier)
            | (JournalVoucher.reference_doc_id == challan_identifier),
        )
        voucher = (await session.execute(stmt)).scalars().first()
        if not voucher:
            raise HTTPException(status_code=404, detail=f"Challan 281 record '{challan_identifier}' not found.")
        if voucher.is_cancelled:
            raise HTTPException(status_code=400, detail=f"Challan 281 '{voucher.voucher_no}' is already cancelled.")

        # Load child GL entries
        gl_stmt = select(GeneralLedgerEntry).where(
            GeneralLedgerEntry.voucher_id == voucher.id,
            GeneralLedgerEntry.is_deleted == False,
        )
        orig_entries = (await session.execute(gl_stmt)).scalars().all()

        acc_tds = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "2030")
        acc_interest = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "5090")

        tax_comp = Decimal("0.00")
        interest_comp = Decimal("0.00")
        bank_account_id = None
        total_credit = Decimal("0.00")

        for ent in orig_entries:
            if ent.account_id == acc_tds.id and (ent.debit_amount or 0) > 0:
                tax_comp += Decimal(str(ent.debit_amount))
            elif ent.account_id == acc_interest.id and (ent.debit_amount or 0) > 0:
                interest_comp += Decimal(str(ent.debit_amount))
            elif (ent.credit_amount or 0) > 0:
                total_credit += Decimal(str(ent.credit_amount))
                bank_account_id = ent.account_id

        if not bank_account_id:
            bank_acc = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1020")
            bank_account_id = bank_acc.id

        total_reversal = (tax_comp + interest_comp).quantize(Decimal("0.01"))
        rev_voucher_no = f"REV-{voucher.voucher_no}"

        rev_voucher = JournalVoucher(
            id=f"jv_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=voucher.branch_id,
            voucher_no=rev_voucher_no,
            voucher_type="CHALLAN_281_CANCEL",
            voucher_date=date.today(),
            posting_date=datetime.now(timezone.utc),
            reference_doc_type="CHALLAN_281_CANCEL",
            reference_doc_id=voucher.id,
            reference_doc_no=voucher.voucher_no,
            narration=f"Reversal of TDS Challan 281 {voucher.voucher_no}. Reason: {reason or 'Cancelled by user'}",
            currency="INR",
            exchange_rate=Decimal("1.000000"),
            total_debit=total_reversal,
            total_credit=total_reversal,
            is_posted=True,
            is_cancelled=False,
            created_by=cancelled_by or "system",
        )
        session.add(rev_voucher)
        await session.flush()

        # Reversal Line 1: Debit Bank
        rev_bank = GeneralLedgerEntry(
            id=f"gle_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=voucher.branch_id,
            voucher_id=rev_voucher.id,
            account_id=bank_account_id,
            entry_date=date.today(),
            posting_date=datetime.now(timezone.utc),
            debit_amount=total_reversal,
            credit_amount=Decimal("0.00"),
            remarks=f"Compensating reversal of Challan 281 {voucher.voucher_no}",
        )
        session.add(rev_bank)

        # Reversal Line 2: Credit TDS Payable 2030
        rev_tds = GeneralLedgerEntry(
            id=f"gle_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=voucher.branch_id,
            voucher_id=rev_voucher.id,
            account_id=acc_tds.id,
            entry_date=date.today(),
            posting_date=datetime.now(timezone.utc),
            debit_amount=Decimal("0.00"),
            credit_amount=tax_comp,
            remarks=f"Reinstating TDS Liability on Challan 281 cancellation",
        )
        session.add(rev_tds)

        # Reversal Line 3: Credit Interest / Late Fee 5090 if any
        if interest_comp > 0:
            rev_charges = GeneralLedgerEntry(
                id=f"gle_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=voucher.branch_id,
                voucher_id=rev_voucher.id,
                account_id=acc_interest.id,
                entry_date=date.today(),
                posting_date=datetime.now(timezone.utc),
                debit_amount=Decimal("0.00"),
                credit_amount=interest_comp,
                remarks=f"Reversal of late fee / interest on Challan 281 cancellation",
            )
            session.add(rev_charges)

        voucher.is_cancelled = True
        await session.flush()

        # Publish outbox audit event
        try:
            await OutboxService.publish(
                db=session,
                company_id=company_id,
                event_type="TDS_CHALLAN_281_CANCELLED",
                payload={
                    "original_voucher_id": voucher.id,
                    "reversal_voucher_id": rev_voucher.id,
                    "amount_reversed": float(total_reversal),
                },
                source_service="Challan281Service",
            )
        except Exception:
            pass

        return cls._to_response(voucher)

    @classmethod
    async def list_challan_281(
        cls,
        session: AsyncSession,
        company_id: str,
        quarter: Optional[str] = None,
        financial_year: Optional[str] = None,
        tds_section: Optional[str] = None,
    ) -> List[Challan281Response]:
        """Lists recorded Challan 281 vouchers matching specified filters."""
        stmt = (
            select(JournalVoucher)
            .where(
                JournalVoucher.company_id == company_id,
                JournalVoucher.voucher_type == "TDS_CHALLAN_281",
                JournalVoucher.is_deleted == False,
            )
            .order_by(desc(JournalVoucher.voucher_date), desc(JournalVoucher.created_at))
        )
        vouchers = (await session.execute(stmt)).scalars().all()

        results = []
        for v in vouchers:
            resp = cls._to_response(v)
            if quarter and resp.quarter.upper() != quarter.upper():
                continue
            if financial_year and resp.financial_year != financial_year:
                continue
            if tds_section and tds_section.upper() != "ALL" and resp.tds_section.upper() != tds_section.upper():
                continue
            results.append(resp)
        return results

    @classmethod
    def _to_response(cls, v: JournalVoucher) -> Challan281Response:
        """Parses JournalVoucher into a typed Challan281Response."""
        meta = cls._deserialize_meta(v.narration or "")
        tax_amt = float(meta.get("TAX", 0.0))
        sur_amt = float(meta.get("SUR", 0.0))
        cess_amt = float(meta.get("CESS", 0.0))
        int_amt = float(meta.get("INT", 0.0))
        fee_amt = float(meta.get("FEE", 0.0))
        pen_amt = float(meta.get("PEN", 0.0))
        tot_amt = float(meta.get("TOT", float(v.total_debit or 0.0)))
        if tot_amt == 0.0:
            tot_amt = float(v.total_debit or 0.0)
        if tax_amt == 0.0 and tot_amt > 0.0:
            tax_amt = tot_amt

        bills_str = meta.get("BILLS", "")
        linked_bills = [b.strip() for b in bills_str.split(",") if b.strip()] if bills_str else None

        clean_narration = (v.narration or "").split("__CHALLAN_281_META__")[0].strip()

        return Challan281Response(
            id=v.id,
            voucher_id=v.id,
            voucher_no=v.voucher_no,
            challan_no=meta.get("CHL", v.reference_doc_id or "00000"),
            bsr_code=meta.get("BSR", "0000000"),
            challan_date=v.voucher_date.isoformat() if v.voucher_date else "",
            tender_date=meta.get("TENDER") or None,
            tax_amount=tax_amt,
            surcharge=sur_amt,
            cess=cess_amt,
            interest=int_amt,
            fee=fee_amt,
            penalty=pen_amt,
            total_amount=tot_amt,
            minor_head=meta.get("HEAD", "200"),
            financial_year=meta.get("FY", "2026-27"),
            quarter=meta.get("QTR", "Q2"),
            tds_section=meta.get("SEC", "194Q"),
            cheque_dd_no=meta.get("REF") or None,
            bank_name=meta.get("BANK") or "State Bank of India",
            bank_account_code=meta.get("ACC", "1020"),
            is_cancelled=v.is_cancelled,
            created_at=v.created_at.isoformat() if v.created_at else "",
            narration=clean_narration or None,
            linked_bill_ids=linked_bills,
        )
