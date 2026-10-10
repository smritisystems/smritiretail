import asyncio
import httpx
import json

async def verify_live_catalog():
    async with httpx.AsyncClient(timeout=30.0) as client:
        l = await client.post('https://tattlythreads.smritisys.com/api/v1/auth/login', json={'username': 'admin', 'password': 'Admin@123'})
        token = l.json().get('access_token')
        headers = {'Authorization': f'Bearer {token}'}

        res = await client.get('https://tattlythreads.smritisys.com/api/v1/items?limit=100', headers=headers)
        print('HTTP Status:', res.status_code)
        if res.status_code == 200:
            items = res.json()
            print(f'Total Items returned: {len(items)}')
            styles = set()
            total_variants = 0
            total_barcodes = 0
            for itm in items:
                styles.add(itm.get('item_code'))
                vars_list = itm.get('variants', [])
                total_variants += len(vars_list)
                bcs_list = itm.get('barcodes', [])
                total_barcodes += len(bcs_list)
            print(f'Unique Styles Loaded: {len(styles)}')
            print(f'Total Variants in batch: {total_variants}')
            print(f'Total Barcodes in batch: {total_barcodes}')
            print('\nSample 10 Live Styles:')
            for itm in items[:10]:
                code = itm.get('item_code')
                brand = itm.get('brand')
                cat = itm.get('category')
                v_cnt = len(itm.get('variants', []))
                b_cnt = len(itm.get('barcodes', []))
                print(f"- Style: {code:<10} | Brand: {brand:<16} | Category: {cat:<10} | Variants: {v_cnt:<3} | Barcodes: {b_cnt:<3}")

if __name__ == '__main__':
    asyncio.run(verify_live_catalog())
