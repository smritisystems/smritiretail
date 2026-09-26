#!/bin/sh
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.14.0
# Created      : 2026-07-11
# Modified     : 2026-07-11
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

set -e

export PYTHONPATH=/app

# Canonical Database Bootstrap Flow (Control-plane + Multi-tenant provision, migrate & seed)
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
    echo "Executing SMRITI Canonical Database Bootstrap Engine..."
    python -m app.db.bootstrap_engine || echo "Notice: Bootstrap engine encountered an issue or is already initialized."
else
    echo "SKIP_MIGRATIONS=true, skipping database bootstrap."
fi

echo "Starting SMRITI FastAPI Python Core..."
exec gunicorn app.main:app \
        -k uvicorn.workers.UvicornWorker \
        -b 0.0.0.0:8000 \
        --workers "${GUNICORN_WORKERS:-2}" \
        --timeout 120
