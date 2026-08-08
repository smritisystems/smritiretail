<!--
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
-->

# SMRITI Retail OS Quick Start

This page is the fastest path to verify the project locally.

## 1. Clone and install

```bash
git clone https://github.com/smritisystems/smritiretail.git
cd smritiretail
npm install
```

## 2. Build the frontend

```bash
npm run build
```

## 3. Run the frontend locally

```bash
npm run dev
```

## 4. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r production.txt -r dev.txt
```

## 5. Run backend checks

```bash
pytest -q
```

## 6. Health-check sequence

- frontend build passes
- dev server starts without fatal errors
- backend starts with FastAPI/Uvicorn
- pytest smoke suite completes

## Good next docs

- [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)
- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [troubleshooting/TROUBLESHOOTING.md](troubleshooting/TROUBLESHOOTING.md)
