from datetime import date, datetime, timedelta, timezone
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import AvailabilityResponse, ErrorResponse, HealthResponse
from .services.ical_service import CalendarFeedError, parse_ical_booked_dates

settings = get_settings()
app = FastAPI(
    title="Ferienhäuser 141 / 136 – Availability API",
    version="0.1.0",
    description="Lokales FastAPI-Backend für die privaten H&P-iCal-Belegungsfeeds.",
)

# The website is served locally by the existing Node static server (port 3000).
# Only local development origins are allowed; no public CORS proxy is used.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept"],
)

_cache: dict[str, tuple[datetime, AvailabilityResponse]] = {}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Ungültige Anfrage."
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(error=message).model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {}
    location = ".".join(str(part) for part in first_error.get("loc", []))
    message = first_error.get("msg", "Ungültige Anfrage.")
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(error=f"Validierungsfehler ({location}): {message}").model_dump(),
    )


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    configured = [house for house in ("141", "136") if settings.feed_url(house)]
    return HealthResponse(configured_houses=configured)


@app.get(
    "/api/availability",
    response_model=AvailabilityResponse,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def availability(
    house: Literal["141", "136"] = Query(..., description="Ferienhausnummer: 141 oder 136"),
) -> AvailabilityResponse:
    now = datetime.now(timezone.utc)
    cached_entry = _cache.get(house)
    if cached_entry and (now - cached_entry[0]).total_seconds() < settings.cache_ttl_seconds:
        cached_model = cached_entry[1].model_copy(update={"cached": True})
        return cached_model

    feed_url = settings.feed_url(house)
    if not feed_url:
        raise HTTPException(
            status_code=503,
            detail=f"Der private H&P-iCal-Feed für Haus {house} ist in der lokalen .env nicht konfiguriert.",
        )

    try:
        async with httpx.AsyncClient(
            timeout=settings.fetch_timeout_seconds,
            follow_redirects=True,
            headers={"Accept": "text/calendar, text/plain;q=0.9"},
        ) as client:
            response = await client.get(feed_url)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=502, detail="Zeitüberschreitung beim Abruf des H&P-Kalenders.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"H&P antwortet mit HTTP {exc.response.status_code}.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Der H&P-Kalender konnte nicht erreicht werden.") from exc

    if len(response.content) > settings.max_ical_bytes:
        raise HTTPException(status_code=502, detail="Der H&P-iCal-Feed überschreitet die erlaubte Dateigröße.")
    try:
        ical_text = response.content.decode("utf-8-sig")
        today = date.today()
        range_end = (today.replace(day=1) + timedelta(days=32 * settings.availability_range_months)).replace(day=1)
        booked_dates = parse_ical_booked_dates(ical_text, today, range_end)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=502, detail="Der H&P-iCal-Feed hat eine ungültige Textkodierung.") from exc
    except CalendarFeedError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    result = AvailabilityResponse(
        house=house,
        booked_dates=booked_dates,
        fetched_at=datetime.now(timezone.utc),
        range_months=settings.availability_range_months,
        cached=False,
    )
    _cache[house] = (datetime.now(timezone.utc), result)
    return result
