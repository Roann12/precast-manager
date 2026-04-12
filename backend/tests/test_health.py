from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"
    assert response.headers.get("X-Request-ID")


def test_root_lists_docs():
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert "health" in body
