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

# Optionally skip migrations (for controlled environments). Set SKIP_MIGRATIONS=true to disable.
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
    echo "Running Alembic database migrations..."
    PYTHONPATH="" alembic -x target=control -x db=smritisys upgrade head || echo "Notice: Alembic migrations encountered an issue or are already up to date."
else
    echo "SKIP_MIGRATIONS=true, skipping Alembic migrations."
fi

export PYTHONPATH=/app

echo "Seeding baseline users and company registries..."
python -m app.db.seed_baseline_users || echo "Notice: Seeding completed or skipped."

echo "Starting SMRITI FastAPI Python Core..."
exec gunicorn app.main:app \
        -k uvicorn.workers.UvicornWorker \
        -b 0.0.0.0:8000 \
        --workers "${GUNICORN_WORKERS:-2}" \
        --timeout 120
