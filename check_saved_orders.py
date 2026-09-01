#!/usr/bin/env python3
import json

with open('db_store.json', 'r') as f:
    data = json.load(f)
    
print("=== DATABASE STRUCTURE ===")
tables = list(data.keys())
print(f"Total tables: {len(tables)}")
print(f"Available tables: {tables[:10]}")

if 'sales_orders' in data:
    so = data['sales_orders']
    print(f"\n=== SALES_ORDERS TABLE ===")
    print(f"Type: {type(so)}")
    print(f"Count: {len(so) if isinstance(so, (list, dict)) else 'N/A'}")
    
    if isinstance(so, list):
        if len(so) > 0:
            print(f"\nFirst order:")
            print(json.dumps(so[0], indent=2)[:1000])
            print(f"\nTotal saved orders: {len(so)}")
    elif isinstance(so, dict):
        keys = list(so.keys())
        print(f"Record keys (first 5): {keys[:5]}")
        print(f"Total saved orders: {len(so)}")
        if keys:
            print(f"\nFirst order:")
            print(json.dumps(so[keys[0]], indent=2)[:1000])
else:
    print("\n!!! sales_orders table not found in database !!!")

# Check if there's any SO-2026-0001
all_orders_str = json.dumps(data)
if 'SO-2026-0001' in all_orders_str:
    print("\n✓ Found SO-2026-0001 reference in database!")
else:
    print("\n✗ SO-2026-0001 NOT found in database")
    
if 'PO-5182778158' in all_orders_str:
    print("✓ Found PO-5182778158 reference in database!")
else:
    print("✗ PO-5182778158 NOT found in database")
