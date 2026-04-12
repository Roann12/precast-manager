## Precast Manager

Precast Manager is a SaaS application for managing operations in precast concrete factories.  
This repo contains:

- **backend**: FastAPI + SQLAlchemy + Pydantic
- **frontend**: React + TypeScript + Material UI
- **database**: PostgreSQL initialization
- **docker**: Dockerfiles for backend and frontend

### Project Structure

```text
precast-manager/
  backend/
    alembic.ini
    migrations/        # Alembic migrations
  frontend/
  database/
  docker/
  docker-compose.yml
```

See below for setup, migrations, and run instructions once code is scaffolded.

### Database migrations (Alembic)

Alembic is configured in the `backend` directory to use the same SQLAlchemy `Base` and database URL as the app.

- **Create a new migration after changing models**:

  ```bash
  cd backend
  .\.venv\Scripts\Activate.ps1  # on Windows
  alembic revision --autogenerate -m "describe change"
  ```

- **Apply migrations**:

  ```bash
  cd backend
  .\.venv\Scripts\Activate.ps1  # on Windows
  alembic upgrade head
  ```

From now on, update models in `app/models`, then generate and apply an Alembic migration instead of editing the database schema manually.

