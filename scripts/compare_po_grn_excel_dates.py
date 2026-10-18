import openpyxl
import datetime
from collections import defaultdict
import httpx
import asyncio

async def main():
    p = r"F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx"
    wb = openpyxl.load_workbook(p, data_only=True)
    ws = wb['Sheet1']

    excel_bills = {}
    for r in list(ws.iter_rows(values_only=True))[2:]:
        v_code = str(r[6]).strip() if r[6] else ''
        b_no = str(r[10]).strip() if r[10] else ''
        b_date = r[11]
        art = str(r[1]).strip() if r[1] else ''
        color = str(r[2]).strip().upper() if r[2] else ''

        # Continuation row handling
        if not b_no:
            if art == 'CH-20' and color == 'BEIGE':
                b_no = '707'
                b_date = datetime.date(2026, 9, 7)
            elif art == 'CH-22':
                b_no = '704'
                b_date = datetime.date(2026, 8, 10)
            elif art == 'CH-23':
                b_no = '706'
                b_date = datetime.date(2026, 8, 22)

        if v_code and b_no and b_no != 'None':
            if isinstance(b_date, datetime.datetime):
                b_date = b_date.date()
            if b_date and b_date.year == 2036:
                b_date = datetime.date(2026, b_date.month, b_date.day)
            clean_b = ''.join(c if c.isalnum() or c in ('-', '_') else '_' for c in b_no).strip('_')
            po_num = f"PO-{v_code}-{clean_b}"
            grn_num = f"GRN-{v_code}-{clean_b}"
            excel_bills[po_num] = {
                'vendor': v_code,
                'bill_no': b_no,
                'excel_bill_date': str(b_date),
                'grn_num': grn_num
            }

    async with httpx.AsyncClient(timeout=30.0) as client:
        login = await client.post('https://tattlythreads.smritisys.com/api/v1/auth/login', json={'username': 'admin', 'password': 'Admin@123'})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        r_po = await client.get('https://tattlythreads.smritisys.com/api/v1/purchase/orders', headers=headers)
        live_pos = {p['order_no']: p for p in r_po.json()}

        r_grn = await client.get('https://tattlythreads.smritisys.com/api/v1/purchase/receipts', headers=headers)
        live_grns = {g['receipt_no']: g for g in r_grn.json()}

        header_line = f"| {'PO NUMBER':<22} | {'EXCEL BILL DATE':<15} | {'LIVE PO DATE':<15} | {'LIVE RECV/BILL DATE':<19} | {'LIVE GRN DATE':<13} |"
        sep_line = "|" + "-" * 24 + "|" + "-" * 17 + "|" + "-" * 17 + "|" + "-" * 21 + "|" + "-" * 15 + "|"
        print(header_line)
        print(sep_line)

        for po_num, info in sorted(excel_bills.items()):
            po = live_pos.get(po_num, {})
            grn = live_grns.get(info['grn_num'], {})

            live_po_date = str(po.get('order_date', 'MISSING'))[:10]
            live_recv_date = str(po.get('delivery_date') or po.get('vendor_bill_date') or 'MISSING')
            live_grn_date = str(grn.get('created_at', '--'))[:10] if grn.get('created_at') else '--'

            row_line = f"| {po_num:<22} | {info['excel_bill_date']:^15} | {live_po_date:^15} | {live_recv_date:^19} | {live_grn_date:^13} |"
            print(row_line)

if __name__ == "__main__":
    asyncio.run(main())
