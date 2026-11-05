from datetime import date

from app.services.ical_service import parse_ical_booked_dates

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
    from app.services.ical_service import CalendarFeedError

    with pytest.raises(CalendarFeedError):
        parse_ical_booked_dates("not an ical feed", date(2026, 1, 1), date(2026, 2, 1))
