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
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_individual_pdf_invoices():
    input_file = r"F:\SMRITRretailNX\exports\SMRITI_Full_Tax_Invoices_Master.json"
    output_dir = r"F:\SMRITRretailNX\exports\individual_invoices"

    os.makedirs(output_dir, exist_ok=True)

    with open(input_file, "r", encoding="utf-8") as f:
        invoices = json.load(f)

    generated_files = []

    for inv in invoices:
        inv_no_clean = inv["invoice_number"].replace("/", "_").replace("-", "_")
        file_name = f"Tax_Invoice_{inv_no_clean}.pdf"
        pdf_path = os.path.join(output_dir, file_name)

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            leftMargin=30,
            rightMargin=30,
            topMargin=30,
            bottomMargin=30
        )

        story = []
        styles = getSampleStyleSheet()

        # Styles
        hdr_style = ParagraphStyle('CompTitle', fontName='Helvetica-Bold', fontSize=16, textColor=colors.HexColor('#1E1B4B'))
        subhdr_style = ParagraphStyle('CompSub', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#475569'))
        title_style = ParagraphStyle('InvTitle', fontName='Helvetica-Bold', fontSize=14, textColor=colors.HexColor('#1E1B4B'), alignment=2)
        
        lbl_style = ParagraphStyle('Lbl', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#334155'))
        val_style = ParagraphStyle('Val', fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#0F172A'))
        
        th_style = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)
        td_style = ParagraphStyle('TD', fontName='Helvetica', fontSize=8)
        td_bold = ParagraphStyle('TDB', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#1E1B4B'))
        td_right = ParagraphStyle('TDR', fontName='Helvetica', fontSize=8, alignment=2)
        td_right_bold = ParagraphStyle('TDRB', fontName='Helvetica-Bold', fontSize=8, alignment=2, textColor=colors.HexColor('#1E1B4B'))

        # Header Block Table
        seller_info = Paragraph(
            "<b>TATTLY THREADS LIMITED</b><br/>"
            "Plot No 42, Industrial Area, Andheri East, Mumbai, MH 400093<br/>"
            "<b>GSTIN: 27AAACT0001A1Z5</b> | Email: billing@tattlythreads.com",
            subhdr_style
        )
        inv_title = Paragraph("TAX INVOICE<br/><font size=8 color='#64748B'>Original for Recipient</font>", title_style)

        hdr_table = Table([[seller_info, inv_title]], colWidths=[330, 205])
        hdr_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(hdr_table)
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1E1B4B'), spaceAfter=10))

        # Metadata Table
        meta_data = [
            [
                Paragraph("<b>Invoice Number:</b> " + inv["invoice_number"], val_style),
                Paragraph("<b>Invoice Date:</b> " + inv["invoice_date"], val_style),
                Paragraph("<b>PO / SO Ref:</b> " + inv["po_so_reference"], val_style)
            ],
            [
                Paragraph("<b>SIS Site Code:</b> SIS-" + inv["sis_site_code"], val_style),
                Paragraph("<b>Payment Mode:</b> " + inv["payment_mode"], val_style),
                Paragraph("<b>Workflow Status:</b> " + inv["status"], val_style)
            ]
        ]
        meta_table = Table(meta_data, colWidths=[180, 180, 175])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # Billing & Shipping Address Table
        bill_to = Paragraph(
            "<b>BILL TO:</b><br/>"
            f"<b>{inv['customer_name']}</b><br/>"
            f"{inv['billing_address']}<br/>"
            f"<b>GSTIN:</b> {inv['customer_gstin']}",
            val_style
        )
        ship_to = Paragraph(
            "<b>SHIP TO:</b><br/>"
            f"<b>{inv['customer_name']}</b><br/>"
            f"{inv['shipping_address']}<br/>"
            f"<b>Destination State:</b> Maharashtra (27)",
            val_style
        )

        addr_table = Table([[bill_to, ship_to]], colWidths=[265, 270])
        addr_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EEF2FF')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#C7D2FE')),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(addr_table)
        story.append(Spacer(1, 12))

        # Line Items Table
        items_data = [
            [
                Paragraph("S.No", th_style),
                Paragraph("HSN/SAC", th_style),
                Paragraph("Item Description & SKU", th_style),
                Paragraph("Qty", ParagraphStyle('THC', parent=th_style, alignment=1)),
                Paragraph("Unit Rate", ParagraphStyle('THR', parent=th_style, alignment=2)),
                Paragraph("Taxable Val", ParagraphStyle('THR', parent=th_style, alignment=2)),
                Paragraph("IGST (18%)", ParagraphStyle('THR', parent=th_style, alignment=2)),
                Paragraph("Total (INR)", ParagraphStyle('THR', parent=th_style, alignment=2))
            ]
        ]

        subtotal = inv["subtotal"]
        igst = inv["igst_amount"]
        grand_total = inv["grand_total"]

        # Item 1
        item1_sub = round(subtotal * 0.6, 2)
        item1_tax = round(igst * 0.6, 2)
        item1_tot = round(item1_sub + item1_tax, 2)

        # Item 2
        item2_sub = round(subtotal - item1_sub, 2)
        item2_tax = round(igst - item1_tax, 2)
        item2_tot = round(item2_sub + item2_tax, 2)

        items_data.append([
            Paragraph("1", td_style),
            Paragraph("610910", td_style),
            Paragraph("Tattly Premium Cotton T-Shirt (Pack of 5)<br/><font color='#64748B'>SKU: TT-TSHIRT-BLK-M</font>", td_style),
            Paragraph("150", ParagraphStyle('TDC', parent=td_style, alignment=1)),
            Paragraph(f"{item1_sub/150:,.2f}", td_right),
            Paragraph(f"{item1_sub:,.2f}", td_right),
            Paragraph(f"{item1_tax:,.2f}", td_right),
            Paragraph(f"{item1_tot:,.2f}", td_right)
        ])

        items_data.append([
            Paragraph("2", td_style),
            Paragraph("620342", td_style),
            Paragraph("Tattly Slim Fit Denim Trousers<br/><font color='#64748B'>SKU: TT-DENIM-BLU-32</font>", td_style),
            Paragraph("80", ParagraphStyle('TDC', parent=td_style, alignment=1)),
            Paragraph(f"{item2_sub/80:,.2f}", td_right),
            Paragraph(f"{item2_sub:,.2f}", td_right),
            Paragraph(f"{item2_tax:,.2f}", td_right),
            Paragraph(f"{item2_tot:,.2f}", td_right)
        ])

        items_table = Table(items_data, colWidths=[25, 50, 175, 35, 60, 65, 60, 65])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E1B4B')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 8))

        # Financial Summary Block Table
        summary_block = [
            [
                Paragraph("<b>Total Taxable Value (Subtotal):</b>", td_right),
                Paragraph(f"INR {subtotal:,.2f}", td_right_bold)
            ],
            [
                Paragraph("<b>Integrated GST (18% IGST):</b>", td_right),
                Paragraph(f"INR {igst:,.2f}", td_right_bold)
            ],
            [
                Paragraph("<b>Invoice Grand Total:</b>", td_right_bold),
                Paragraph(f"<b>INR {grand_total:,.2f}</b>", ParagraphStyle('TotVal', parent=td_right_bold, fontSize=10, textColor=colors.HexColor('#1E1B4B')))
            ]
        ]
        tot_table = Table(summary_block, colWidths=[380, 155])
        tot_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
            ('BACKGROUND', (0,2), (-1,2), colors.HexColor('#EEF2FF')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(tot_table)
        story.append(Spacer(1, 15))

        bank_name = os.getenv("DEFAULT_BANK_NAME", "")
        bank_acc = os.getenv("DEFAULT_BANK_ACCOUNT", "")
        bank_ifsc = os.getenv("DEFAULT_BANK_IFSC", "")
        bank_branch = os.getenv("DEFAULT_BANK_BRANCH", "")
        bank_str = f"Bank Name: {bank_name}<br/>Account No: {bank_acc} | IFSC: {bank_ifsc}<br/>Branch: {bank_branch}" if bank_acc else "Bank Details on file"

        # Bank Details & Signatory Table
        bank_info = Paragraph(
            f"<b>BANK DETAILS FOR REMITTANCE:</b><br/>{bank_str}",
            val_style
        )
        sign_info = Paragraph(
            "<b>For TATTLY THREADS LIMITED</b><br/><br/><br/>"
            "<b>Authorised Signatory</b>",
            ParagraphStyle('Sign', parent=val_style, alignment=2)
        )

        footer_table = Table([[bank_info, sign_info]], colWidths=[320, 215])
        footer_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ]))
        story.append(footer_table)

        doc.build(story)
        generated_files.append(pdf_path)
        print(f"Generated: {file_name}")

    print("==========================================================")
    print(f"SUCCESSFULLY GENERATED ALL {len(generated_files)} INDIVIDUAL PDF INVOICES")
    print("==========================================================")
    print(f"Output Directory: {output_dir}")

if __name__ == "__main__":
    generate_individual_pdf_invoices()
