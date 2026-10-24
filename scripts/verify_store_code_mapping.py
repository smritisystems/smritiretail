# -*- coding: utf-8 -*-
"""
Verify all store codes in 278 invoices exist in remote delivery locations
Author: Jawahar Ramkripal Mallah
"""
import psycopg2
import requests

def main():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT delivery_store_code FROM sales_invoices WHERE invoice_no LIKE 'TT2026-2027/%';")
    inv_store_codes = {r[0] for r in cur.fetchall() if r[0]}
    conn.close()

    l = requests.post("https://tattlythreads.smritisys.com/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"}, verify=False)
    t = l.json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    r = requests.get("https://tattlythreads.smritisys.com/api/v1/customers/cust-rrl-192b561d/delivery-locations", headers=h, verify=False)
    remote_codes = {loc["storeCode"]: loc["id"] for loc in r.json()}

    missing = inv_store_codes - set(remote_codes.keys())
    print(f"Total distinct invoice store codes: {len(inv_store_codes)}")
    print(f"Total remote store locations: {len(remote_codes)}")
    print(f"Missing store codes: {missing}")

if __name__ == "__main__":
    main()
