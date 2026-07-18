#!/bin/sh
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.14.0
# Created      : 2026-07-11
# Modified     : 2026-07-11
# Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

set -e

export PYTHONPATH=/app

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
    echo "Running Alembic database migrations..."
    alembic upgrade head
else
    echo "SKIP_MIGRATIONS=true, skipping Alembic migrations."
fi

echo "Running default database seeds..."
python -m app.db.seed

echo "Starting SMRITI FastAPI Python Core..."
exec gunicorn app.main:app \
        -k uvicorn.workers.UvicornWorker \
        -b 0.0.0.0:8000 \
        --workers "${GUNICORN_WORKERS:-2}" \
        --timeout 120
