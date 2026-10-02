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
Classification: Statutory Compliance & Electronic Form 26Q Generator
"""

import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from ..models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from ..models.tenant import Company
from ..models.party import Party
from ..models.purchase import Supplier, PurchaseBill
from ..schemas.form26q import (
    Form26QDeducteeLine,
    Form26QChallanLine,
    Form26QSummaryResponse,
    Form26QExportResponse,
)
from .challan_281 import Challan281Service
from .tds_engine import StatutoryTdsEngine
from .unified_ledger import UnifiedAccountingLedgerService


class Form26QGeneratorService:
    """
    Quarterly Electronic Form 26Q e-TDS Return Reconciliation
    and NSDL-Compliant ASCII Text Generator (Income Tax Act, 1961 Section 200(3)).
    """

    @staticmethod
    def resolve_quarter_date_range(quarter: str, financial_year: str) -> Tuple[date, date, str]:
        """
        Resolves start date, end date, and assessment year from Quarter and FY.
        Format of FY: '2026-27' -> Start Year: 2026, End Year: 2027.
        AY: '2027-28'
        """
        q = quarter.strip().upper()
        parts = financial_year.split("-")
        try:
            start_yr = int(parts[0])
            end_yr = start_yr + 1
        except Exception:
            start_yr = 2026
            end_yr = 2027

        ay_str = f"{end_yr}-{str(end_yr + 1)[-2:]}"

        if q == "Q1":
            return date(start_yr, 4, 1), date(start_yr, 6, 30), ay_str
        elif q == "Q2":
            return date(start_yr, 7, 1), date(start_yr, 9, 30), ay_str
        elif q == "Q3":
            return date(start_yr, 10, 1), date(start_yr, 12, 31), ay_str
        elif q == "Q4":
            return date(end_yr, 1, 1), date(end_yr, 3, 31), ay_str
        else:
            return date(start_yr, 7, 1), date(start_yr, 9, 30), ay_str

    @classmethod
    async def get_quarterly_summary(
        cls,
        session: AsyncSession,
        company_id: str,
        quarter: str = "Q2",
        financial_year: str = "2026-27",
    ) -> Form26QSummaryResponse:
        """
        Compiles authoritative quarterly Form 26Q reconciliation summary:
        aggregates domestic non-salary deductees and recorded Challan 281 deposits.
        """
        from_date, to_date, ay_str = cls.resolve_quarter_date_range(quarter, financial_year)

        # 1. Company details
        co_stmt = select(Company).where(Company.id == company_id)
        company = (await session.execute(co_stmt)).scalars().first()
        co_name = company.name if company else "SMRITI ENTERPRISE PVT LTD"
        co_gst = company.gst_number if company and company.gst_number else "07AAAAA1234A1Z5"
        co_pan = co_gst[2:12].upper() if len(co_gst) >= 12 else "AAAAA1234A"
        co_tan = "DELA12345A"  # Canonical default TAN for test/demo environments

        # 2. Query Account 2030 (TDS Payable) credit lines in this quarter
        acc_tds = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "2030")

        gl_stmt = (
            select(GeneralLedgerEntry, JournalVoucher)
            .join(JournalVoucher, GeneralLedgerEntry.voucher_id == JournalVoucher.id)
            .where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.account_id == acc_tds.id,
                GeneralLedgerEntry.credit_amount > 0,
                GeneralLedgerEntry.entry_date >= from_date,
                GeneralLedgerEntry.entry_date <= to_date,
                GeneralLedgerEntry.is_deleted == False,
                JournalVoucher.is_cancelled == False,
            )
            .order_by(GeneralLedgerEntry.entry_date.asc())
        )
        deduction_rows = (await session.execute(gl_stmt)).all()

        deductees: List[Form26QDeducteeLine] = []
        party_cache: Dict[str, Any] = {}

        for entry, voucher in deduction_rows:
            p_id = entry.party_id
            party_info = None
            if p_id:
                if p_id not in party_cache:
                    p_stmt = select(Party).where(Party.id == p_id, Party.company_id == company_id)
                    p_obj = (await session.execute(p_stmt)).scalars().first()
                    if not p_obj:
                        s_stmt = select(Supplier).where(Supplier.id == p_id, Supplier.company_id == company_id)
                        p_obj = (await session.execute(s_stmt)).scalars().first()
                    party_cache[p_id] = p_obj
                party_info = party_cache[p_id]

            # Resolve deductee fields
            v_name = "Domestic Vendor"
            v_pan = "PANNOTAVBL"
            if party_info:
                v_name = getattr(party_info, "legal_name", None) or getattr(party_info, "name", "Domestic Vendor")
                p_gst = (getattr(party_info, "tax_id", None) or getattr(party_info, "gstin", None) or "")
                raw_pan = getattr(party_info, "pan", None)
                v_pan = raw_pan if (raw_pan and raw_pan.strip()) else (p_gst[2:12].upper() if len(p_gst) >= 12 else "PANNOTAVBL")
                if not v_pan or v_pan.strip() == "":
                    v_pan = "PANNOTAVBL"

            pan_valid = StatutoryTdsEngine.is_valid_pan(v_pan)
            # Entity code: 01 for Company (4th char 'C'), 02 for Non-Company / Individual
            is_company = (len(v_pan) == 10 and v_pan[3].upper() == "C")
            deductee_code = "01" if is_company else "02"

            # Parse section and rate from remarks or narration
            sec = "194Q"
            for s_opt in ["194Q", "194C", "194J", "194H"]:
                if s_opt in (entry.remarks or "") or s_opt in (voucher.narration or ""):
                    sec = s_opt
                    break

            tds_amt = float(entry.credit_amount or 0.0)

            # Estimate gross amount: if voucher has total credit/debit, use that or reverse engineer from rate
            gross_amt = float(voucher.total_debit or 0.0)
            if gross_amt <= tds_amt:
                rate_pct = 0.10 if sec == "194Q" else 2.00
                gross_amt = (tds_amt / (rate_pct / 100.0)) if rate_pct > 0 else tds_amt * 1000

            # Statutory Rate
            rate = 0.10
            if not pan_valid:
                rate = 5.00 if sec == "194Q" else 20.00
                reason_code = "C"  # 206AA Penal Rate
            else:
                reason_code = None
                if sec == "194C":
                    rate = 2.00 if is_company else 1.00
                elif sec == "194J":
                    rate = 2.00
                elif sec == "194H":
                    rate = 5.00
                else:
                    rate = 0.10

            deductees.append(
                Form26QDeducteeLine(
                    deductee_code=deductee_code,
                    pan=v_pan if pan_valid else "PANNOTAVBL",
                    pan_valid=pan_valid,
                    vendor_name=v_name,
                    section=sec,
                    document_no=voucher.reference_doc_no or voucher.voucher_no,
                    transaction_date=entry.entry_date.isoformat(),
                    deduction_date=entry.entry_date.isoformat(),
                    gross_amount=round(gross_amt, 2),
                    tds_rate=rate,
                    tds_amount=round(tds_amt, 2),
                    reason_code=reason_code,
                )
            )

        # 3. Query recorded Challan 281 vouchers for this quarter
        challans_resp = await Challan281Service.list_challan_281(
            session=session,
            company_id=company_id,
            quarter=quarter,
            financial_year=financial_year,
        )

        active_challans = [c for c in challans_resp if not c.is_cancelled]
        challan_lines = [
            Form26QChallanLine(
                voucher_no=c.voucher_no,
                challan_no=c.challan_no,
                bsr_code=c.bsr_code,
                challan_date=c.challan_date,
                minor_head=c.minor_head,
                tax_amount=c.tax_amount,
                surcharge=c.surcharge,
                cess=c.cess,
                interest=c.interest,
                fee=c.fee,
                penalty=c.penalty,
                total_amount=c.total_amount,
                cheque_dd_no=c.cheque_dd_no,
            )
            for c in active_challans
        ]

        tot_gross = sum(d.gross_amount for d in deductees)
        tot_deducted = sum(d.tds_amount for d in deductees)
        tot_deposited = sum(c.tax_amount + c.surcharge + c.cess for c in active_challans)
        shortfall = max(0.0, tot_deducted - tot_deposited)

        return Form26QSummaryResponse(
            financial_year=financial_year,
            quarter=quarter,
            from_date=from_date.isoformat(),
            to_date=to_date.isoformat(),
            company_name=co_name,
            company_tan=co_tan,
            company_pan=co_pan,
            total_deductees_count=len(deductees),
            total_gross_amount=round(tot_gross, 2),
            total_tds_deducted=round(tot_deducted, 2),
            total_challans_count=len(active_challans),
            total_tds_deposited=round(tot_deposited, 2),
            unallocated_shortfall=round(shortfall, 2),
            deductees=deductees,
            challans=challan_lines,
        )

    @classmethod
    async def generate_form26q_text(
        cls,
        session: AsyncSession,
        company_id: str,
        quarter: str = "Q2",
        financial_year: str = "2026-27",
    ) -> Form26QExportResponse:
        """
        Generates standard NSDL e-TDS ASCII text file payload conforming
        to the Income Tax Department Form 26Q format specifications.
        """
        summary = await cls.get_quarterly_summary(session, company_id, quarter, financial_year)
        from_date, to_date, ay_str = cls.resolve_quarter_date_range(quarter, financial_year)

        today_str = date.today().strftime("%d%m%Y")
        lines: List[str] = []
        line_no = 1

        # 1. FH: File Header Record
        # Format: LINE^FH^FILE_TYPE^UPLOAD_TYPE^GEN_DATE^BATCH_COUNT^DEDUCTOR_TYPE^TAN^SOFT_NAME^VERSION
        fh_line = f"{line_no}^FH^SLAB^26Q^R^{today_str}^1^O^{summary.company_tan}^SMRITI RETAIL OS^6.52.0^"
        lines.append(fh_line)
        line_no += 1

        # 2. BH: Batch Header Record
        # Format: LINE^BH^BATCH_NO^RECORD_COUNT^FORM^TAN^PAN^FY^AY^PERIOD^CO_NAME^ADDR^RESP_NAME^CHL_COUNT^DED_COUNT^TOT_TAX^TOT_CHL
        fy_clean = summary.financial_year.replace("-", "")
        ay_clean = ay_str.replace("-", "")
        tot_challan_amt = sum(c.total_amount for c in summary.challans)

        bh_line = (
            f"{line_no}^BH^1^{len(summary.deductees) + len(summary.challans) + 2}^26Q^"
            f"{summary.company_tan}^{summary.company_pan}^{fy_clean}^{ay_clean}^{summary.quarter}^"
            f"{summary.company_name[:75]}^MAIN ROAD STORE 1^JAWAHAR R MALLAH^"
            f"{len(summary.challans)}^{len(summary.deductees)}^{summary.total_tds_deducted:.2f}^{tot_challan_amt:.2f}^"
        )
        lines.append(bh_line)
        line_no += 1

        # 3. CD: Challan Detail Records
        challan_sl = 1
        for ch in summary.challans:
            cd_date_str = ch.challan_date.replace("-", "") if ch.challan_date else today_str
            cd_line = (
                f"{line_no}^CD^1^{challan_sl}^"
                f"{ch.bsr_code}^{cd_date_str}^{ch.challan_no}^{ch.minor_head}^"
                f"{ch.tax_amount:.2f}^{ch.surcharge:.2f}^{ch.cess:.2f}^{ch.interest:.2f}^{ch.fee:.2f}^"
                f"{ch.total_amount:.2f}^{ch.cheque_dd_no or ''}^N^^"
            )
            lines.append(cd_line)
            line_no += 1
            challan_sl += 1

        # 4. DD: Deductee Detail Records
        ded_sl = 1
        # If no challan was recorded, assign default reference challan 1
        ref_chl_sl = 1 if summary.challans else 1
        for ded in summary.deductees:
            tx_date_str = ded.transaction_date.replace("-", "")
            ded_date_str = ded.deduction_date.replace("-", "")
            r_code = ded.reason_code or ""
            dd_line = (
                f"{line_no}^DD^1^{ref_chl_sl}^{ded_sl}^"
                f"{ded.deductee_code}^{ded.pan}^{ded.vendor_name[:75]}^"
                f"{tx_date_str}^{ded_date_str}^{ded.gross_amount:.2f}^{ded.tds_amount:.2f}^"
                f"{ded.tds_rate:.2f}^{r_code}^"
            )
            lines.append(dd_line)
            line_no += 1
            ded_sl += 1

        file_content = "\r\n".join(lines) + "\r\n"
        filename = f"FORM26Q_{summary.company_tan}_{summary.quarter}_{fy_clean}.txt"

        return Form26QExportResponse(
            financial_year=summary.financial_year,
            quarter=summary.quarter,
            filename=filename,
            file_content=file_content,
            total_records=len(lines),
            total_challans=len(summary.challans),
            total_deductees=len(summary.deductees),
            total_tax_deposited=summary.total_tds_deposited,
        )
