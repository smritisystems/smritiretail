-- SQL Script to clone databases for staging reconciliation
-- Must be executed with -U postgres on the postgres database

-- Terminate all connections to production databases
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname IN ('smritisys', 'smriti001') 
  AND pid <> pg_backend_pid()
  AND usename NOT IN ('postgres');

-- Wait a moment (PostgreSQL processing)
SELECT pg_sleep(1);

-- Confirm connections terminated
SELECT datname, COUNT(*) as session_count 
FROM pg_stat_activity 
WHERE datname IN ('smritisys', 'smriti001')
  AND pid <> pg_backend_pid()
GROUP BY datname;

-- Clone smritisys
DROP DATABASE IF EXISTS smritisys_stage WITH (FORCE);
CREATE DATABASE smritisys_stage WITH TEMPLATE smritisys;
SELECT 'smritisys_stage created' as result;

-- Clone smriti001
DROP DATABASE IF EXISTS smriti001_stage WITH (FORCE);
CREATE DATABASE smriti001_stage WITH TEMPLATE smriti001;
SELECT 'smriti001_stage created' as result;

-- Verify clones
SELECT datname, pg_database_size(datname) as size_bytes
FROM pg_database
WHERE datname IN ('smritisys_stage', 'smriti001_stage')
ORDER BY datname;
