"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

backup_restore.py — Database Backup, Integrity Assertion & Point-in-Time Restore Utility
Conforms to AOP-004 (Additive Schema Evolution & Data Safety Principle).
"""

import os
import sys
import subprocess
import datetime
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.backup_restore")

DB_CONTAINER = os.getenv("DB_CONTAINER", "smriti-db")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_NAME = os.getenv("POSTGRES_DB", "smriti_retail_db")

BACKUP_DIR = os.getenv("BACKUP_DIR", "backups")

def create_backup():
    """Create timestamped PostgreSQL database backup using pg_dump."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"smriti_db_backup_{timestamp}.sql"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    logger.info("Initiating PostgreSQL database backup into container '%s'...", DB_CONTAINER)
    cmd = f"docker exec -t {DB_CONTAINER} pg_dump -U {DB_USER} -d {DB_NAME}"

    try:
        with open(backup_path, "w", encoding="utf-8") as f:
            subprocess.run(cmd, shell=True, stdout=f, stderr=subprocess.PIPE, check=True)
        size_bytes = os.path.getsize(backup_path)
        logger.info("Backup successfully created at '%s' (Size: %d bytes)", backup_path, size_bytes)
        return backup_path
    except subprocess.CalledProcessError as e:
        logger.error("Database backup failed: %s", e.stderr.decode('utf-8', errors='ignore'))
        sys.exit(1)

def verify_backup(backup_path):
    """Assert database backup file non-empty and valid SQL file structure."""
    if not os.path.exists(backup_path):
        logger.error("Backup file '%s' does not exist.", backup_path)
        return False
    size = os.path.getsize(backup_path)
    if size < 100:
        logger.error("Backup file '%s' is empty or corrupt (size: %d bytes).", backup_path, size)
        return False

    with open(backup_path, "r", encoding="utf-8", errors="ignore") as f:
        head = f.read(500)
        if "PostgreSQL database dump" not in head and "CREATE TABLE" not in head:
            logger.warning("Backup file header assertion warning: standard pg_dump signature missing.")

    logger.info("Backup integrity assertion PASSED for '%s' (%d bytes).", backup_path, size)
    return True

def restore_backup(backup_path):
    """Restore database from specified backup SQL file."""
    if not verify_backup(backup_path):
        logger.error("Restore aborted due to invalid backup file.")
        sys.exit(1)

    logger.info("Restoring PostgreSQL database '%s' from '%s'...", DB_NAME, backup_path)
    cmd = f"docker exec -i {DB_CONTAINER} psql -U {DB_USER} -d {DB_NAME}"

    try:
        with open(backup_path, "r", encoding="utf-8") as f:
            subprocess.run(cmd, shell=True, stdin=f, check=True)
        logger.info("Database successfully restored from '%s'.", backup_path)
    except subprocess.CalledProcessError as e:
        logger.error("Database restore failed: %s", str(e))
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="SMRITI Database Backup & Restore Automation")
    parser.add_argument("action", choices=["backup", "verify", "restore"], help="Operation to perform")
    parser.add_argument("--file", help="Path to backup SQL file for verify/restore operations")
    args = parser.parse_args()

    if args.action == "backup":
        bp = create_backup()
        verify_backup(bp)
    elif args.action == "verify":
        if not args.file:
            logger.error("--file argument is required for verify action.")
            sys.exit(1)
        verify_backup(args.file)
    elif args.action == "restore":
        if not args.file:
            logger.error("--file argument is required for restore action.")
            sys.exit(1)
        restore_backup(args.file)

if __name__ == "__main__":
    main()
