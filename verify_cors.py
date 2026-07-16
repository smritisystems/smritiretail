import os
import sys
import requests
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'backend'))
from app.core.config import settings

print('ALLOWED_ORIGINS =', settings.ALLOWED_ORIGINS)

for url in ['http://127.0.0.1:8000/version', 'http://127.0.0.1:8000/api/v1/metadata']:
    try:
        r = requests.get(url, headers={'Origin': 'http://localhost:5000'}, timeout=10)
        print('URL:', url)
        print('  status:', r.status_code)
        print('  Access-Control-Allow-Origin:', r.headers.get('Access-Control-Allow-Origin'))
        print('  Access-Control-Allow-Credentials:', r.headers.get('Access-Control-Allow-Credentials'))
        print('  response snippet:', r.text[:250].replace('\n', ' '))
    except Exception as exc:
        print('URL:', url, 'FAILED:', exc)
