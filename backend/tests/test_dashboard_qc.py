# File overview: Application module logic for tests/test_dashboard_qc.py.
"""
Dashboard QC metrics and /qc/queue alignment.

Uses in-memory SQLite + dependency overrides so tests do not require PostgreSQL.
"""

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 — register models on Base.metadata
from app.auth.dependencies import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.element import Element
from app.models.factory import Factory
from app.models.mould import Mould
from app.models.production import ProductionSchedule
from app.models.project import Project
from app.models.quality import QualityTest
from app.services.qc_lab_queue import build_qc_lab_queue

FACTORY_ID = 1
FIXED_TODAY = date(2026, 4, 17)


@pytest.fixture
# Handles qc api client flow.
def qc_api_client():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    db = SessionLocal()

    # Handles override get db flow.
    def override_get_db():
        try:
            yield db
        finally:
            pass

    fake_user = SimpleNamespace(
        id=999,
        factory_id=FACTORY_ID,
        role="admin",
        email="pytest@example.com",
        name="Pytest Admin",
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: fake_user

    with TestClient(app) as client:
        yield client, db

    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


# Handles  seed minimal factory flow.
def _seed_minimal_factory(db, *, production_date: date, batch_id: str = "BATCH-QC-1") -> None:
    db.add(Factory(id=FACTORY_ID, name="pytest-factory", is_active=True))
    db.add(
        Project(
            id=1,
            factory_id=FACTORY_ID,
            project_name="pytest-project",
            client=None,
            status="active",
        )
    )
    db.add(
        Mould(
            id=1,
            factory_id=FACTORY_ID,
            name="pytest-mould-1",
            mould_type="wall",
            capacity=10,
            cycle_time_hours=8,
            active=True,
        )
    )
    db.add(
        Element(
            id=1,
            factory_id=FACTORY_ID,
            project_id=1,
            mix_design_id=None,
            element_type="beam",
            element_mark="E-1",
            quantity=5,
            volume=None,
            due_date=None,
            concrete_strength_mpa=40,
            requires_cubes=True,
            panel_length_mm=None,
            slab_thickness_mm=None,
            active=True,
            status="planned",
        )
    )
    db.add(
        ProductionSchedule(
            id=1,
            factory_id=FACTORY_ID,
            element_id=1,
            mould_id=1,
            production_date=production_date,
            quantity=3,
            batch_id=batch_id,
            status="completed",
        )
    )
    db.commit()


@patch("app.routers.dashboard.date")
@patch("app.services.qc_lab_queue.date")
# Handles test dashboard overview includes qc fields and zeros flow.
def test_dashboard_overview_includes_qc_fields_and_zeros(
    mock_qc_date, mock_dash_date, qc_api_client
):
    mock_qc_date.today.return_value = FIXED_TODAY
    mock_dash_date.today.return_value = FIXED_TODAY

    client, _db = qc_api_client
    response = client.get("/dashboard/overview")
    assert response.status_code == 200
    data = response.json()

    for key in (
        "qc_lab_overdue",
        "qc_lab_due_today",
        "qc_lab_due_tomorrow",
        "qc_manual_results_pending",
    ):
        assert key in data
        assert isinstance(data[key], int)

    assert data["qc_lab_overdue"] == 0
    assert data["qc_lab_due_today"] == 0
    assert data["qc_lab_due_tomorrow"] == 0
    assert data["qc_manual_results_pending"] == 0


@patch("app.routers.dashboard.date")
@patch("app.services.qc_lab_queue.date")
# Handles test qc queue counts match dashboard overview flow.
def test_qc_queue_counts_match_dashboard_overview(mock_qc_date, mock_dash_date, qc_api_client):
    mock_qc_date.today.return_value = FIXED_TODAY
    mock_dash_date.today.return_value = FIXED_TODAY

    client, db = qc_api_client
    # 7d due date = production_date + 7; pick production so 7d test is overdue vs FIXED_TODAY.
    production_date = FIXED_TODAY - timedelta(days=14)
    _seed_minimal_factory(db, production_date=production_date)

    q = client.get("/qc/queue").json()
    ov = client.get("/dashboard/overview").json()

    assert len(q["overdue"]) == ov["qc_lab_overdue"]
    assert len(q["today"]) == ov["qc_lab_due_today"]
    assert len(q["tomorrow"]) == ov["qc_lab_due_tomorrow"]

    built = build_qc_lab_queue(db, FACTORY_ID)
    assert len(built["overdue"]) == ov["qc_lab_overdue"]


@patch("app.services.qc_lab_queue.date")
# Handles test build qc lab queue overdue when 7d missing flow.
def test_build_qc_lab_queue_overdue_when_7d_missing(mock_qc_date, qc_api_client):
    mock_qc_date.today.return_value = FIXED_TODAY
    _, db = qc_api_client
    production_date = FIXED_TODAY - timedelta(days=14)
    _seed_minimal_factory(db, production_date=production_date)

    out = build_qc_lab_queue(db, FACTORY_ID)
    assert len(out["overdue"]) >= 1
    ages = {x["age_days"] for x in out["overdue"]}
    assert 7 in ages


@patch("app.routers.dashboard.date")
@patch("app.services.qc_lab_queue.date")
# Handles test qc manual results pending counts pass null past test date flow.
def test_qc_manual_results_pending_counts_pass_null_past_test_date(
    mock_qc_date, mock_dash_date, qc_api_client
):
    mock_qc_date.today.return_value = FIXED_TODAY
    mock_dash_date.today.return_value = FIXED_TODAY

    client, db = qc_api_client
    _seed_minimal_factory(db, production_date=FIXED_TODAY - timedelta(days=30))

    db.add(
        QualityTest(
            element_id=1,
            batch_id=None,
            mix_design_id=None,
            test_type="Cube compressive strength",
            result="pending",
            age_days=7,
            test_date=FIXED_TODAY,
            passed=None,
        )
    )
    db.commit()

    ov = client.get("/dashboard/overview").json()
    assert ov["qc_manual_results_pending"] == 1
