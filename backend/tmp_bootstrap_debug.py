import json
import urllib.request
import urllib.error

url = 'http://127.0.0.1:8001/api/v1/auth/bootstrap'
data = {'username': 'admin', 'password': 'Admin@123', 'email': 'admin@smriti.local'}
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print('STATUS', resp.status)
        print(resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('STATUS', e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print('ERROR', repr(e))
