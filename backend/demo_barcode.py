"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from app.core.barcode.token_registry import build_token_dict, get_registry_for_api
from app.core.barcode.prn_generator import generate_prn_script
from app.services.barcode_engine import BarcodeEngineService

# 1. Token Registry Reference
tokens = get_registry_for_api()
print("=== SMRITI BARCODE TOKEN REGISTRY ===")
print(f"Total Registered Tokens: {len(tokens)}")
for t in tokens[:5]:
    print(f"  {t['token']:20s} | {t['category']:12s} | {t['description'][:50]}")
print("  ... and more\n")

# 2. Generate ZPL barcode label for 2 demo items
items = [
    {
        "code": "BBM-SPORTS-BLK-08",
        "name": "BBM Sports Black Shoe",
        "brand": "Tattly Threads",
        "barcode": "8901234567890",
        "mrp": 1899,
        "size": "8",
        "color": "BLACK",
        "material": "100% LEATHER"
    },
    {
        "code": "TS-POLO-WHT-L",
        "name": "Classic White Polo Shirt",
        "brand": "SMRITI Fashion",
        "barcode": "8901234567891",
        "mrp": 999,
        "size": "L",
        "color": "WHITE",
        "material": "100% COTTON"
    }
]

result = generate_prn_script(items, protocol="ZPL", label_size="50x25")
print("=== PRN GENERATION RESULT ===")
print(f"Protocol: {result['protocol']}")
print(f"Total Labels: {result['total_labels']}")
print(f"Items Processed: {result['items_processed']}")
print(f"Script Length: {len(result['prn'])} bytes")
print()
print("=== RAW ZPL SCRIPT (First 600 bytes) ===")
print(result["prn"][:600])
print()

# 3. Printer Registry
printers = BarcodeEngineService.list_printers()
print("=== REGISTERED HARDWARE PRINTERS ===")
for p in printers:
    print(f"  [{p['printer_id']}] {p['name']} ({p['connection_type']}) @ {p['address']}:{p['port']} [{p['protocol']}]")
print()

# 4. Token Build Example
token_dict = build_token_dict(items[0])
print("=== RESOLVED TOKEN MAP (Item 1) ===")
for k, v in token_dict.items():
    print(f"  {{{k}:20s}} = {v}")
