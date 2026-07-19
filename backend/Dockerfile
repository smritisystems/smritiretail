# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.14.2
# Created      : 2026-07-11
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

FROM python:3.11-slim AS runtime
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

LABEL org.opencontainers.image.title="SMRITI Retail OS — Python Core"
LABEL org.opencontainers.image.vendor="SmritiSys"
LABEL org.opencontainers.image.url="https://smritisys.com"
LABEL org.opencontainers.image.documentation="https://smritisys.com/docs"
LABEL org.opencontainers.image.licenses="Proprietary"

COPY requirements.txt production.txt dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
