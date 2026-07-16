#!/bin/bash
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-07-13
# Modified     : 2026-07-13
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS - Linux / macOS One-Command Installer${NC}"
echo -e "${GREEN}=====================================================================${NC}"

# 1. Check Prerequisites
echo -e "${YELLOW}[1/4] Verifying system prerequisites...${NC}"
prereqs=("git" "node" "python3" "docker")
missing=()

for cmd in "${prereqs[@]}"; do
    if command -v "$cmd" >/dev/null 2>&1; then
        version=$($cmd --version 2>&1 | head -n 1)
        echo -e "  ✓ $cmd is installed ($version)"
    else
        echo -e "  ${RED}✗ $cmd is NOT installed.${NC}"
        missing+=("$cmd")
    fi
done

if [ ${#missing[@]} -ne 0 ]; then
    echo -e "${RED}[WARNING] Missing prerequisites: ${missing[*]}.${NC}"
    echo -e "${YELLOW}Please install them to ensure full functionality (Docker is highly recommended).${NC}"
fi

# 2. Setup Environment Configuration File
echo -e "${YELLOW}[2/4] Setting up environment configuration (.env)...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ✓ Created .env file from .env.example template."
    else
        echo -e "  ${RED}✗ .env.example template not found. Creating default .env...${NC}"
        cat <<EOT > .env
PORT=3000
BACKEND_API_PORT=8000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=smriti_retail_db
DATABASE_PROVIDER=postgres
EOT
        echo -e "  ✓ Created default .env file."
    fi
else
    echo -e "  ✓ .env file already exists. Skipping copy."
fi

# 3. Create Python Virtual Environment & Install Backend Dependencies
echo -e "${YELLOW}[3/4] Setting up Python virtual environment and dependencies...${NC}"
if [ ! -d ".venv" ]; then
    echo -e "  Creating virtual environment (.venv)..."
    python3 -m venv .venv 2>/dev/null || python -m venv .venv 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "  ✓ Virtual environment created."
    else
        echo -e "  ${RED}✗ Failed to create virtual environment.${NC}"
    fi
else
    echo -e "  ✓ Virtual environment (.venv) already exists."
fi

if [ -f ".venv/bin/pip" ]; then
    echo -e "  Installing Python dependencies (backend/requirements.txt)..."
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r backend/requirements.txt
    echo -e "  ✓ Python dependencies installed successfully."
else
    echo -e "  ${RED}[SKIP] Python pip not found. Virtual environment might be corrupt.${NC}"
fi

# 4. Install Node.js Frontend Dependencies
echo -e "${YELLOW}[4/4] Installing frontend Node.js dependencies...${NC}"
if command -v npm >/dev/null 2>&1; then
    echo -e "  Running npm install..."
    npm install
    echo -e "  ✓ Node.js dependencies installed successfully."
else
    echo -e "  ${RED}✗ npm command not found. Cannot install frontend packages.${NC}"
fi

# Ensure launch scripts are executable
chmod +x startup.sh 2>/dev/null

echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS installation complete!${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo -e "To launch SMRITI Retail OS:"
echo -e "  Run: ./startup.sh (or docker compose up -d)"
echo -e "  Access Frontend : http://localhost:3000"
echo -e "  Access Backend  : http://localhost:8000"
echo -e "${GREEN}=====================================================================${NC}"
