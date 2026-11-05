from datetime import date

from backend.app.services.ical_service import parse_ical_booked_dates

SAMPLE_ICAL = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ferienhaus Test//DE
BEGIN:VEVENT
UID:booking-1@example.test
DTSTAMP:20261105T100000Z
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261113
SUMMARY:Booking
END:VEVENT
BEGIN:VEVENT
UID:booking-2@example.test
DTSTAMP:20261105T100000Z
DTSTART:20261115T120000Z
DTEND:20261115T160000Z
SUMMARY:Same-day booking
END:VEVENT
END:VCALENDAR
"""


def test_all_day_end_date_is_exclusive_and_timed_event_blocks_its_day():
    result = parse_ical_booked_dates(
        SAMPLE_ICAL,
        date(2026, 11, 1),
        date(2026, 12, 1),
    )
    assert result == [
        date(2026, 11, 10),
        date(2026, 11, 11),
        date(2026, 11, 12),
        date(2026, 11, 15),
    ]


def test_invalid_calendar_is_rejected():
    import pytest
    from backend.app.services.ical_service import CalendarFeedError

    with pytest.raises(CalendarFeedError):
        parse_ical_booked_dates("not an ical feed", date(2026, 1, 1), date(2026, 2, 1))


def test_recurring_events_expand_and_exdate_removes_single_occurrence():
    recurring_ical = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ferienhaus Recurrence Test//DE
BEGIN:VEVENT
UID:recurring-booking@example.test
DTSTAMP:20261105T100000Z
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261111
RRULE:FREQ=DAILY;COUNT=3
EXDATE;VALUE=DATE:20261111
SUMMARY:Recurring booking
END:VEVENT
BEGIN:VEVENT
UID:cancelled-booking@example.test
DTSTAMP:20261105T100000Z
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261121
STATUS:CANCELLED
SUMMARY:Cancelled booking
END:VEVENT
END:VCALENDAR
"""

    result = parse_ical_booked_dates(
        recurring_ical,
        date(2026, 11, 1),
        date(2026, 12, 1),
    )

    assert result == [date(2026, 11, 10), date(2026, 11, 12)]


def test_events_are_clipped_to_requested_date_range():
    result = parse_ical_booked_dates(
        SAMPLE_ICAL,
        date(2026, 11, 11),
        date(2026, 11, 12),
    )

    assert result == [date(2026, 11, 11)]


def test_invalid_date_range_is_rejected():
    import pytest

    with pytest.raises(ValueError, match="range_end"):
        parse_ical_booked_dates(
            SAMPLE_ICAL,
            date(2026, 12, 1),
            date(2026, 11, 1),
        )
