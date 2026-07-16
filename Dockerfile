# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-07-11
# Modified     : 2026-07-13
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

# ---------------------------------------------------------------------
# Stage 1: Build Frontend and Server
# ---------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------------------------------------------------------------------
# Stage 2: Production Runtime
# ---------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for healthcheck curl and git CLI
RUN apk add --no-cache curl git

COPY --from=builder /usr/src/app .

EXPOSE 3000

CMD ["npx", "tsx", "gateway.ts"]
