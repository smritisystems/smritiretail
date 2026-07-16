import os
import sys
import uuid
sys.path.insert(0, os.getcwd())
from backend.app.core.config import settings
from backend.app.core.security import create_access_token

payload = {
    'sub': 'usr-test-1',
    'username': 'test_user',
    'role': 'MANAGER',
    'company_id': 'comp-test-1',
    'branch_id': 'br-test-1',
    'jti': str(uuid.uuid4()),
}
print(create_access_token(payload))
