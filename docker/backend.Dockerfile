FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app

#
# Run migrations on startup so schema updates are applied consistently.
# `depends_on` doesn't wait for Postgres readiness, so use a small retry loop.
#
CMD ["sh", "-c", "until sh -c \"python -c 'from app.database import Base, engine; import app.models; Base.metadata.create_all(bind=engine)' && alembic stamp 960aaacb348f && alembic stamp 5a5c04ac6d32 && alembic upgrade head\"; do echo 'Waiting for database...'; sleep 2; done; uvicorn app.main:app --host 0.0.0.0 --port 8000"]

