import urllib.request
urls = [
    'http://127.0.0.1:8000/api/terms/clauses',
    'http://127.0.0.1:8000/api/exchange/partners',
    'http://127.0.0.1:8000/api/customers',
    'http://127.0.0.1:8000/api/numbering/series'
]
for url in urls:
    print('URL:', url)
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            status = r.status
            body = r.read(1000).decode('utf-8', errors='replace')
            print('Status:', status)
            print('Body:', body)
    except urllib.error.HTTPError as e:
        body = e.read(1000).decode('utf-8', errors='replace')
        print('Status:', e.code)
        print('Body:', body)
    except Exception as e:
        print('ERROR:', type(e).__name__, e)
    print('---')
