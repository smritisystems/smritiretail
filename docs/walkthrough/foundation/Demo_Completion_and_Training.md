# SMRITI Retail OS Demo Completion & Training Guide

## Overview
This document describes how to complete the local SMRITI Retail OS demo using the browser frontend and the FastAPI backend.

## Prerequisites
- Local PostgreSQL database running and accessible on `127.0.0.1:5432`
- Node.js and npm installed
- Python 3.11 installed
- Backend dependencies installed in the active Python environment
- Frontend dependencies installed in the repository root

## Step 1: Start the backend
1. Open a terminal in `f:\SMRITRretailNXmgrt\backend`
2. Ensure the correct Python interpreter is used:
   - `py -3.11 -m pip install -r requirements.txt`
3. Start the FastAPI backend:
   - `py -3.11 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload`
4. Confirm the backend is healthy:
   - `http://127.0.0.1:8000/health`

## Step 2: Start the frontend
1. Open a terminal in `f:\SMRITRretailNXmgrt`
2. Install dependencies if needed:
   - `npm install`
3. Start Vite:
   - `npm run dev`
4. Open the browser at `http://localhost:4173`

## Step 3: Bootstrap the first SYSADMIN user
1. If no users exist in the database, call:
   - `POST http://127.0.0.1:8000/api/v1/auth/bootstrap`
   - Payload example:
     ```json
     {
       "username": "admin",
       "email": "admin@smriti.local",
       "password": "Admin@123"
     }
     ```
2. Expected response:
   - `201` with the new admin user payload
3. If the backend returns a schema error on `status`, update the `users.status` column to at least `varchar(50)`.

## Step 4: Log in via the browser
1. Open the app at `http://localhost:4173`
2. Enter credentials:
   - Username: `admin`
   - Password: `Admin@123`
2. Enter:
   - Current password: `Admin@123`
   - New password: `Admin@Secure2`
   - Confirm new password: `Admin@Secure2`

## Step 6: Continue into the demo
1. After password reset, the app will redirect into the setup wizard.
2. The first step shown is `Configure Your Retail Ecosystem`.
3. Select one of:
   - `Brand New Company`
   - `Load Demo Data`
   - `Restore Backup`
4. Continue through setup until the main workspace loads.

## Troubleshooting
- `401 Unauthorized` on login:
  - Verify local storage token is cleared
  - Ensure backend is running on port `8000`
- `403 Forbidden` on app startup:
  - Confirm the user is still in `PendingPasswordChange` state or has a valid company/branch assignment
- `Status length` errors on bootstrap:
  - Alter `users.status` to `varchar(50)`

## Notes
- The frontend proxies `/api/v1/*` requests to `http://127.0.0.1:8000`
- The login screen uses `localStorage` key `smriti_jwt_token`
- The first admin user must be created before any authenticated operations

## Completed Demo Credentials
- Username: `admin`
- Initial password: `Admin@123`
- Updated password: `Admin@Secure2`
- Email: `admin@smriti.local`

## Appendix: Helpful backend commands
- Validate database connectivity:
  - `py -3.11 -c "import asyncpg; ..."`
- Check local ports:
  - `py -3.11 -c "import socket; ..."`

---
This guide is intended for local demo setup and training new operators on the SMRITI Retail OS browser workflow.
