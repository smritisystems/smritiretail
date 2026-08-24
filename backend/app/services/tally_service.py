"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal
from typing import Dict, Any, Optional
import xml.etree.ElementTree as ET
from xml.dom import minidom
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from ..models.crm import Customer
from ..models.tenant import Company


class TallyIntegrationService:
    """
    SMRITI TallyPrime Integration & Schema Export Hub (Section 12).
    Generates standard, validated Tally XML DTD envelopes for financial vouchers and invoices.
    """

    @classmethod
    async def generate_tally_sales_voucher_xml(
        cls,
        session: AsyncSession,
        company_id: str,
        invoice_id: str
    ) -> str:
        """
        Generates standard TallyPrime XML voucher for a B2B/B2C Sales Invoice.
        Includes Party Ledger, Sales Account, CGST, SGST, IGST, and Inventory allocation.
        """
        # 1. Fetch Invoice and items
        stmt = select(SalesInvoice).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.id == invoice_id,
            SalesInvoice.is_deleted == False
        )
        invoice = (await session.execute(stmt)).scalar_one_or_none()
        if not invoice:
            raise ValueError(f"Sales Invoice {invoice_id} not found in company {company_id}")

        items_stmt = select(SalesInvoiceItem).where(
            SalesInvoiceItem.invoice_id == invoice.id
        )
        items = (await session.execute(items_stmt)).scalars().all()

        # 2. Fetch Customer / Party
        cust_name = "Cash Sales"
        if invoice.customer_id:
            c_stmt = select(Customer).where(Customer.id == invoice.customer_id)
            cust = (await session.execute(c_stmt)).scalar_one_or_none()
            if cust:
                cust_name = cust.name

        # 3. Build XML Structure
        envelope = ET.Element("ENVELOPE")
        header = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

        body = ET.SubElement(envelope, "BODY")
        import_data = ET.SubElement(body, "IMPORTDATA")
        req_desc = ET.SubElement(import_data, "REQUESTDESC")
        ET.SubElement(req_desc, "REPORTNAME").text = "Vouchers"
        
        tally_msg = ET.SubElement(import_data, "REQUESTDATA")
        tmsg = ET.SubElement(tally_msg, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
        
        voucher = ET.SubElement(tmsg, "VOUCHER", {
            "VCHTYPE": "Sales",
            "ACTION": "Create",
            "OBJVIEW": "Invoice Voucher View"
        })

        date_str = invoice.date.strftime("%Y%m%d") if invoice.date else ""
        ET.SubElement(voucher, "DATE").text = date_str
        ET.SubElement(voucher, "VOUCHERTYPENAME").text = "Sales"
        ET.SubElement(voucher, "VOUCHERNUMBER").text = invoice.invoice_no
        ET.SubElement(voucher, "PARTYLEDGERNAME").text = cust_name
        ET.SubElement(voucher, "PERSISTEDVIEW").text = "Invoice Voucher View"

        # Party Ledger Allocation (Debit Party)
        ledger_party = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(ledger_party, "LEDGERNAME").text = cust_name
        ET.SubElement(ledger_party, "ISDEEMEDPOSITIVE").text = "Yes"
        ET.SubElement(ledger_party, "AMOUNT").text = f"-{invoice.grand_total:.2f}"

        # Sales Account Allocation (Credit Sales)
        taxable_val = float(invoice.taxable_value or (invoice.grand_total - (invoice.tax_total or 0)))
        ledger_sales = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
        ET.SubElement(ledger_sales, "LEDGERNAME").text = "Sales Account"
        ET.SubElement(ledger_sales, "ISDEEMEDPOSITIVE").text = "No"
        ET.SubElement(ledger_sales, "AMOUNT").text = f"{taxable_val:.2f}"

        # Tax Ledgers (CGST / SGST / IGST)
        tax_total = float(invoice.tax_total or 0)
        if tax_total > 0:
            if invoice.is_interstate:
                ledger_igst = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
                ET.SubElement(ledger_igst, "LEDGERNAME").text = "Output IGST"
                ET.SubElement(ledger_igst, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(ledger_igst, "AMOUNT").text = f"{tax_total:.2f}"
            else:
                half_tax = tax_total / 2.0
                ledger_cgst = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
                ET.SubElement(ledger_cgst, "LEDGERNAME").text = "Output CGST"
                ET.SubElement(ledger_cgst, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(ledger_cgst, "AMOUNT").text = f"{half_tax:.2f}"

                ledger_sgst = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
                ET.SubElement(ledger_sgst, "LEDGERNAME").text = "Output SGST"
                ET.SubElement(ledger_sgst, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(ledger_sgst, "AMOUNT").text = f"{half_tax:.2f}"

        # Inventory Items Breakdown
        for itm in items:
            inv_entry = ET.SubElement(voucher, "ALLINVENTORYENTRIES.LIST")
            ET.SubElement(inv_entry, "STOCKITEMNAME").text = itm.name
            ET.SubElement(inv_entry, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(inv_entry, "RATE").text = f"{float(itm.price):.2f}"
            ET.SubElement(inv_entry, "ACTUALQTY").text = f"{float(itm.quantity):.2f}"
            ET.SubElement(inv_entry, "BILLEDQTY").text = f"{float(itm.quantity):.2f}"
            ET.SubElement(inv_entry, "AMOUNT").text = f"{float(itm.total_amount):.2f}"

        xml_str = ET.tostring(envelope, encoding="utf-8")
        parsed = minidom.parseString(xml_str)
        return parsed.toprettyxml(indent="  ")

    @classmethod
    async def generate_tally_journal_voucher_xml(
        cls,
        session: AsyncSession,
        company_id: str,
        voucher_id: str
    ) -> str:
        """
        Generates standard TallyPrime XML voucher for a Double-Entry Journal Voucher.
        """
        jv_stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.id == voucher_id,
            JournalVoucher.is_deleted == False
        )
        jv = (await session.execute(jv_stmt)).scalar_one_or_none()
        if not jv:
            raise ValueError(f"Journal Voucher {voucher_id} not found in company {company_id}")

        gl_stmt = select(GeneralLedgerEntry).where(
            GeneralLedgerEntry.company_id == company_id,
            GeneralLedgerEntry.voucher_id == jv.id,
            GeneralLedgerEntry.is_deleted == False
        )
        entries = (await session.execute(gl_stmt)).scalars().all()

        envelope = ET.Element("ENVELOPE")
        header = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

        body = ET.SubElement(envelope, "BODY")
        import_data = ET.SubElement(body, "IMPORTDATA")
        req_desc = ET.SubElement(import_data, "REQUESTDESC")
        ET.SubElement(req_desc, "REPORTNAME").text = "Vouchers"
        
        tally_msg = ET.SubElement(import_data, "REQUESTDATA")
        tmsg = ET.SubElement(tally_msg, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
        
        voucher = ET.SubElement(tmsg, "VOUCHER", {
            "VCHTYPE": "Journal",
            "ACTION": "Create"
        })

        date_str = jv.voucher_date.strftime("%Y%m%d") if jv.voucher_date else ""
        ET.SubElement(voucher, "DATE").text = date_str
        ET.SubElement(voucher, "VOUCHERTYPENAME").text = "Journal"
        ET.SubElement(voucher, "VOUCHERNUMBER").text = jv.voucher_no
        ET.SubElement(voucher, "NARRATION").text = jv.narration or "SMRITI GL Journal Posting"

        for gle in entries:
            acc_name = gle.account_id
            acc_stmt = select(Account).where(Account.id == gle.account_id)
            acc = (await session.execute(acc_stmt)).scalar_one_or_none()
            if acc:
                acc_name = acc.account_name

            ledger = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(ledger, "LEDGERNAME").text = acc_name
            is_debit = float(gle.debit_amount) > 0
            ET.SubElement(ledger, "ISDEEMEDPOSITIVE").text = "Yes" if is_debit else "No"
            amt = -float(gle.debit_amount) if is_debit else float(gle.credit_amount)
            ET.SubElement(ledger, "AMOUNT").text = f"{amt:.2f}"

        xml_str = ET.tostring(envelope, encoding="utf-8")
        parsed = minidom.parseString(xml_str)
        return parsed.toprettyxml(indent="  ")
