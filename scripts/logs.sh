#!/usr/bin/env bash
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-09-23
# Modified     : 2026-09-23
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

SERVICE="${1:-}"
TAIL="${2:-100}"

if [ -n "$SERVICE" ]; then
    echo "Displaying logs for $SERVICE (tail: $TAIL)..."
    docker compose logs -f --tail="$TAIL" "$SERVICE"
else
    echo "Displaying all SMRITI container logs (tail: $TAIL)..."
    docker compose logs -f --tail="$TAIL"
fi
