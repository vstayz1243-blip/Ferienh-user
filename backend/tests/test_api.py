from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

import backend.app.main as api


@pytest.fixture
def client():
    api._cache.clear()
    with TestClient(api.app) as test_client:
        yield test_client
    api._cache.clear()


def test_health_response_has_expected_contract(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["backend"] == "python-fastapi"
    assert isinstance(payload["configuredHouses"], list)


@pytest.mark.parametrize("house", ["999", "141;136", ""])
def test_invalid_house_is_rejected_by_pydantic(client, house):
    response = client.get("/api/availability", params={"house": house})

    assert response.status_code == 422
    assert "error" in response.json()


def test_missing_house_is_rejected_by_pydantic(client):
    response = client.get("/api/availability")

    assert response.status_code == 422


def test_availability_returns_validated_payload_and_uses_cache(client, monkeypatch):
    start = date.today() + timedelta(days=10)
    checkout = start + timedelta(days=2)
    start_text = start.strftime("%Y%m%d")
    checkout_text = checkout.strftime("%Y%m%d")
    ical = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ferienhaus API Test//DE
BEGIN:VEVENT
UID:api-booking@example.test
DTSTAMP:20260101T120000Z
DTSTART;VALUE=DATE:{start_text}
DTEND;VALUE=DATE:{checkout_text}
SUMMARY:Test booking
END:VEVENT
END:VCALENDAR
""".encode()

    class FakeSettings:
        cache_ttl_seconds = 60
        fetch_timeout_seconds = 1
        availability_range_months = 18
        max_ical_bytes = 100_000

        @staticmethod
        def feed_url(house):
            return "https://feed.example.test/calendar.ics" if house == "141" else None

    class FakeResponse:
        content = ical

        @staticmethod
        def raise_for_status():
            return None

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            assert url == "https://feed.example.test/calendar.ics"
            return FakeResponse()

    monkeypatch.setattr(api, "settings", FakeSettings())
    monkeypatch.setattr(api.httpx, "AsyncClient", FakeAsyncClient)

    first = client.get("/api/availability", params={"house": "141"})
    assert first.status_code == 200
    payload = first.json()
    assert payload["house"] == "141"
    assert payload["bookedDates"] == [
        (start + timedelta(days=offset)).isoformat() for offset in range(2)
    ]
    assert payload["cached"] is False
    assert payload["rangeMonths"] == 18
    assert payload["fetchedAt"]

    second = client.get("/api/availability", params={"house": "141"})
    assert second.status_code == 200
    assert second.json()["cached"] is True


def test_unconfigured_feed_returns_503(client, monkeypatch):
    class EmptySettings:
        cache_ttl_seconds = 60

        @staticmethod
        def feed_url(house):
            return None

    monkeypatch.setattr(api, "settings", EmptySettings())

    response = client.get("/api/availability", params={"house": "136"})

    assert response.status_code == 503
    assert "error" in response.json()


def test_cors_allows_local_website_origin(client):
    response = client.options(
        "/api/availability",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
