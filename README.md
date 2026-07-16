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

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS (Frontend Prototype)

This repository contains the standalone React/TypeScript frontend prototype for **SMRITI Retail OS**, an Enterprise Experience & Operational Intelligence platform.

## Overview
This is a demonstration of the client-side architectural concepts, component library, and Layout Engine (SRLE) of the SMRITI platform. It runs independently of the Python/Frappe backend framework to enable rapid UI prototyping, layout testing, and design iterations.

## Stack
- **React 18**
- **TypeScript**
- **Tailwind CSS v4**
- **Vite**
- **Framer Motion**

## Features Included in Prototype
- SMRITI Layout Engine (SRLE) dynamic workspaces
- Print Engine Studio with real ZPL/TSPL template integration
- Drill-down global search and side-panels
- Notification Engine
- Metadata Registry API
- Mocked POS and Supply Chain dashboards

## Development

Install dependencies:
\`\`\`bash
npm install
\`\`\`

Run the development server:
\`\`\`bash
npm run dev
\`\`\`

## Note
This is exclusively the frontend prototype / UI harness. All backend business logic, database integrations, Frappe components, and Docker orchestrations have been stripped from this artifact for simplicity.
