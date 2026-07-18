<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.2
  * Created    : 2026-07-18
  * Modified   : 2026-07-18
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# End-User Training — Company & Demo Details

## Company Overview
- Company Name: **Tattly Threads**
- GST Registration: **Regular Scheme (Nil Registered)**
- Business Type: **Retail**
- Financial Year: **2026-2027**
- Books Start Date: **2026-04-01**

## Store / Branch Details
- Store Name: **Main Flagship Store**
- Store Code: **GKP01**
- Store Type: **Company Owned**
- Branch Code: **BR-01** (auto-generated during setup)

## Provisioned Staff Users
- **SMRITI Owner** — Role: **Owner**
- **Kishore Kumar** — Role: **Cashier**

## Demo Login Credentials
- First SYSADMIN username: **admin**
- First SYSADMIN password (temporary): **Admin@123**
- Updated SYSADMIN password after the first login: **Admin@Secure2**
- Email: **admin@smriti.local**

> Note: The initial password is only valid for the first login. The system requires the admin to change the password during first login.

## Demo URLs
- Frontend: `http://localhost:4173`
- Backend API: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`

## Demo Flow Summary
1. Start the backend service in `backend/`.
2. Start the frontend from the repository root.
3. Use the bootstrap endpoint if the demo database has no users yet.
4. Login with `admin` and complete the mandatory first password reset.
5. Continue into the interactive setup wizard.

## Important Notes for End Users
- The app proxies `/api/v1/*` to the backend.
- If the setup wizard reports `Company setup has already been completed`, refresh the browser.
- A successful setup changes the application state from the wizard to the main dashboard.
- The demo company and users shown here are the current local provisioned state.

## Common Troubleshooting
- If login fails, clear `localStorage` keys `smriti_jwt_token` and `smriti_session_token` and reload.
- If backend startup fails, verify Python 3.11 and required packages are installed.
- If bootstrap fails due to schema issues, ensure the database column `users.status` is at least `varchar(50)`.
