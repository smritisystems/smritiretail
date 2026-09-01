#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Add project root to path
root = Path(__file__).parent
backend_root = root / 'backend'
sys.path.insert(0, str(backend_root))
sys.path.insert(0, str(root))

# Load .env file
from dotenv import load_dotenv
load_dotenv(root / '.env')

# Verify environment is loaded
print(f"✓ Loaded .env from {root / '.env'}")
print(f"  JWT_SECRET_KEY: {'***' if os.getenv('JWT_SECRET_KEY') else 'NOT SET'}")
print(f"  DATABASE_URL: postgresql://...")
print(f"  Starting FastAPI server...")
print()

# Start uvicorn
import uvicorn
uvicorn.run(
    "app.main:app",
    host="0.0.0.0",
    port=8000,
    reload=False,
    log_level="info"
)
