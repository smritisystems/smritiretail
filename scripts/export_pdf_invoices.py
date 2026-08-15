"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import os, json
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_export():
    input_file = r"F:\SMRITRretailNX\exports\SMRITI_Full_Tax_Invoices_Master.json"
    pdf_output = r"F:\SMRITRretailNX\exports\SMRITI_Full_Tax_Invoices_Master.pdf"

    with open(input_file, "r", encoding="utf-8") as f:
        invoices = json.load(f)

    doc = SimpleDocTemplate(
        pdf_output,
        pagesize=landscape(letter),
        leftMargin=20,
        rightMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    story = []
    styles = getSampleStyleSheet()

    # Title & Subtitle Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#1E1B4B'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )

    story.append(Paragraph("SMRITI Retail OS — Master Tax Invoice Export Report", title_style))
    story.append(Paragraph("Statutory Detail Export including Shipping Address, Billing Address, PO References, Tax Breakdowns, and Status.", subtitle_style))

    # Summary Table
    summary_data = [
        ["TOTAL INVOICES", "TOTAL TAXABLE SUBTOTAL", "TOTAL 18% IGST TAX", "TOTAL INVOICED GRAND VALUE"],
        ["10 Invoices", "INR 13,26,096.60", "INR 66,303.75", "INR 13,92,400.35"]
    ]
    sum_table = Table(summary_data, colWidths=[150, 200, 180, 220])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E1B4B')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),

        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#EEF2FF')),
        ('TEXTCOLOR', (0,1), (-1,1), colors.HexColor('#1E1B4B')),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,1), 11),
        ('BOTTOMPADDING', (0,1), (-1,1), 8),
        ('TOPPADDING', (0,1), (-1,1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#C7D2FE')),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 15))

    # Table Header & Rows
    cell_hdr_style = ParagraphStyle('Hdr', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)
    cell_body_style = ParagraphStyle('Body', fontName='Helvetica', fontSize=7.5, leading=9)
    cell_bold_style = ParagraphStyle('BodyB', fontName='Helvetica-Bold', fontSize=7.5, leading=9, textColor=colors.HexColor('#1E1B4B'))
    cell_right_style = ParagraphStyle('BodyR', fontName='Helvetica', fontSize=7.5, leading=9, alignment=2)
    cell_right_bold_style = ParagraphStyle('BodyRB', fontName='Helvetica-Bold', fontSize=7.5, leading=9, alignment=2, textColor=colors.HexColor('#1E1B4B'))

    table_data = [
        [
            Paragraph("Invoice #", cell_hdr_style),
            Paragraph("Date", cell_hdr_style),
            Paragraph("Buyer & GSTIN", cell_hdr_style),
            Paragraph("SIS / PO Ref", cell_hdr_style),
            Paragraph("Billing Address", cell_hdr_style),
            Paragraph("Shipping Address", cell_hdr_style),
            Paragraph("Subtotal (INR)", ParagraphStyle('HdrR', parent=cell_hdr_style, alignment=2)),
            Paragraph("IGST (18%)", ParagraphStyle('HdrR', parent=cell_hdr_style, alignment=2)),
            Paragraph("Grand Total", ParagraphStyle('HdrR', parent=cell_hdr_style, alignment=2)),
            Paragraph("Status", cell_hdr_style)
        ]
    ]

    for inv in invoices:
        table_data.append([
            Paragraph(inv["invoice_number"], cell_bold_style),
            Paragraph(inv["invoice_date"], cell_body_style),
            Paragraph(f"<b>{inv['customer_name']}</b><br/>GSTIN: {inv['customer_gstin']}", cell_body_style),
            Paragraph(f"SIS: {inv['sis_site_code']}<br/>PO: {inv['po_so_reference']}", cell_body_style),
            Paragraph(inv["billing_address"], cell_body_style),
            Paragraph(inv["shipping_address"], cell_body_style),
            Paragraph(f"{inv['subtotal']:,.2f}", cell_right_style),
            Paragraph(f"{inv['igst_amount']:,.2f}", cell_right_style),
            Paragraph(f"<b>{inv['grand_total']:,.2f}</b>", cell_right_bold_style),
            Paragraph(inv["status"], cell_bold_style)
        ])

    col_widths = [65, 50, 100, 75, 130, 130, 60, 50, 60, 42]
    invoice_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    invoice_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#334155')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
    ]))

    story.append(invoice_table)
    doc.build(story)

    print("==========================================================")
    print("SMRITI PDF TAX INVOICE MASTER EXPORT GENERATED")
    print("==========================================================")
    print(f"PDF File: {pdf_output}")

if __name__ == "__main__":
    generate_pdf_export()
