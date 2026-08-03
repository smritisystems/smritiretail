#!/bin/sh
# Project      : SMRITI Retail OS
# Subsystem    : SMRITI Worker Execution Engine (DDS v1.0)
# Description  : Entrypoint script for smriti-worker container
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

set -e

export PYTHONPATH=/app

echo "[smriti-worker] Initializing SMRITI Background Worker process..."
echo "[smriti-worker] Connecting to Redis Broker at ${REDIS_HOST:-smriti-redis}:${REDIS_PORT:-6379}..."

# Health check file marker
mkdir -p /tmp/smriti-worker
echo "READY" > /tmp/smriti-worker/status

trap 'echo "[smriti-worker] Gracefully draining jobs during shutdown..."; echo "STOPPING" > /tmp/smriti-worker/status; exit 0' SIGTERM SIGINT

echo "[smriti-worker] Worker process active. Listening for queue tasks..."

# Run python worker loop
exec python -m app.worker
