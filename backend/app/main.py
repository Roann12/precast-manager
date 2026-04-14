# File overview: Application module logic for app/main.py.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .core.config import settings
from .middleware.request_id import RequestIdMiddleware
from .rate_limit import limiter
from . import models  # ensure models are imported so relationships resolve
from .routers import projects
from .routers import elements
from .routers import moulds
from .routers import planner
from .routers import production
from .routers import yard
from .routers import dispatch
from .routers import dashboard
from .routers import dev
from .routers import qc
from .routers import mix_designs
from .routers import hollowcore
from .routers import auth
from .routers import wetcasting

# Keep imports above so SQLAlchemy relationships resolve at startup.
# Schema changes are managed with Alembic migrations, not create_all().

app = FastAPI(title=settings.PROJECT_NAME)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(elements.router)
app.include_router(moulds.router)
app.include_router(planner.router)
app.include_router(yard.router)
app.include_router(dispatch.router)
app.include_router(dashboard.router)
app.include_router(production.router)
if settings.ENABLE_DEV_ENDPOINTS and settings.ENVIRONMENT != "production":
    app.include_router(dev.router)
app.include_router(qc.router)
app.include_router(mix_designs.router)
app.include_router(hollowcore.router)
app.include_router(wetcasting.router)
app.include_router(auth.auth_router)
app.include_router(auth.admin_router)


@app.get("/")
# Handles root flow.
def root():
    return {"message": "Precast Manager API", "health": "/health", "docs": "/docs"}


@app.get("/health")
# Handles health flow.
def health():
    return {"status": "ok"}


