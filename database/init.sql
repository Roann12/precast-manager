-- This project no longer uses this file by default.
-- Postgres is configured via docker-compose using environment variables:
--   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
--
-- If you choose to use an init script, DO NOT hardcode real passwords in git.
-- Example template only:
--   CREATE USER precast WITH PASSWORD 'CHANGE_ME_STRONG_DB_PASSWORD';
--   CREATE DATABASE precast_manager OWNER precast;
--   GRANT ALL PRIVILEGES ON DATABASE precast_manager TO precast;

