-- Supabase / PostgreSQL bootstrap (run once per environment before migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: case-insensitive email matching
-- CREATE EXTENSION IF NOT EXISTS "citext";