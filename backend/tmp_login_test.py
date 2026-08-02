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

import json
import urllib.request
import urllib.error

url = "http://127.0.0.1:8000/api/v1/auth/login"
data = {
    "username": "admin",
    "password": "Admin@123",
}
req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print("STATUS", resp.status)
        print(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("ERROR", e.code)
    print(e.read().decode("utf-8"))
except Exception as e:
    print("EXCEPTION", repr(e))
