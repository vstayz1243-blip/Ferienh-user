from datetime import date, datetime, timedelta, timezone
from typing import Iterable

import recurring_ical_events
from icalendar import Calendar


class CalendarFeedError(Exception):
    """Raised when an H&P iCalendar feed cannot be fetched or parsed."""


def _as_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        # Occupancy is displayed by local calendar day. Preserve the date
        # represented by the feed instead of converting it to the server TZ.
        return value.date()
    return value


def _event_days(event, range_start: date, range_end: date) -> Iterable[date]:
    if str(event.get("STATUS", "")).upper() == "CANCELLED":
        return

    start_value = event.get("DTSTART")
    end_value = event.get("DTEND")
    if start_value is None or end_value is None:
        return

    start = _as_date(start_value.dt)
    end = _as_date(end_value.dt)

    # DATE-valued DTEND is exclusive according to RFC 5545. A timed event
    # beginning and ending on the same date still blocks that calendar day.
    if isinstance(start_value.dt, datetime) and start == end:
        end += timedelta(days=1)

    cursor = max(start, range_start)
    boundary = min(end, range_end)
    while cursor < boundary:
        yield cursor
        cursor += timedelta(days=1)


def parse_ical_booked_dates(
    ical_text: str,
    range_start: date,
    range_end: date,
) -> list[date]:
    if range_end <= range_start:
        raise ValueError("range_end must be later than range_start")
    if "BEGIN:VCALENDAR" not in ical_text.upper():
        raise CalendarFeedError("H&P hat keine gültige iCalendar-Datei geliefert.")

    try:
        calendar = Calendar.from_ical(ical_text)
        # Expand RRULE/RDATE and apply EXDATE/RECURRENCE-ID exceptions.
        occurrences = recurring_ical_events.of(calendar).between(
            range_start,
            range_end,
        )
    except Exception as exc:
        raise CalendarFeedError("Der H&P-iCal-Feed konnte nicht geparst werden.") from exc

    booked: set[date] = set()
    for event in occurrences:
        booked.update(_event_days(event, range_start, range_end))

    return sorted(booked)
