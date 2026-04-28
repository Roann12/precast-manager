# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Three-tier app: React frontend (Vite, port 5173), FastAPI backend (uvicorn, port 8000), PostgreSQL 16 (port 5432). See `README.md` for project structure.

### Environment variables

Copy `.env.example` to `.env` and adjust for dev. Key vars: `POSTGRES_SERVER=localhost`, `ENVIRONMENT=development`, `ENABLE_DEV_ENDPOINTS=true`, `JWT_SECRET_KEY` (min 16 chars). The backend reads `.env` from the `backend/` parent directory (repo root).

### PostgreSQL

PostgreSQL 16 must be running before starting the backend. Start with `sudo pg_ctlcluster 16 main start`. Dev credentials: user `precast`, password `precast_dev_password`, database `precast_manager`.

### Database schema

The initial Alembic migration (`960aaacb348f`) is incremental — it assumes tables already exist. For a fresh database, create tables from models first, then stamp head:

```bash
cd backend
POSTGRES_SERVER=localhost JWT_SECRET_KEY=dev_secret_key_at_least_16_chars_long \
  python3 -c "from app.database import Base, engine; from app import models; Base.metadata.create_all(bind=engine)"
POSTGRES_SERVER=localhost JWT_SECRET_KEY=dev_secret_key_at_least_16_chars_long \
  python3 -m alembic stamp head
```

### Running services

- **Backend**: `cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` (set env vars or use `.env`)
- **Frontend**: `cd frontend && VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0` (the `VITE_API_BASE_URL` override is needed when running Vite separately from the Docker nginx proxy)

### Seeding demo data

1. Create a super admin user (factory_id=None, role=admin) directly or use the seeded `superadmin@local` / `superadmin123`.
2. POST to `/dev/seed` with admin Bearer token (requires `ENABLE_DEV_ENDPOINTS=true` and `ENVIRONMENT != production`).
3. Seeded factory admin: `admin@local` / `admin123` (has factory_id set, useful for testing all endpoints).

### Tests

- **Backend**: `cd backend && python3 -m pytest -q --tb=short` (conftest auto-sets `JWT_SECRET_KEY`)
- **Frontend unit**: `cd frontend && npm run test`
- **Frontend build**: `cd frontend && npm run build`
- **Frontend E2E**: `cd frontend && npx playwright install --with-deps chromium && npm run test:e2e`

### Lint

No dedicated linter configured in package.json scripts. TypeScript checking is via `npm run build` (Vite + tsc). Backend has no explicit linter in requirements.txt.
