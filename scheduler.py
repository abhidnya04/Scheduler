# scheduler.py
from datetime import datetime, timedelta, time, timezone
from zoneinfo import ZoneInfo
from typing import List, Tuple, Dict
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase (server-side service key)
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

# Use the broad Calendar scope so we can both read availability and create events.
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar"]

def _creds_for(email: str) -> Credentials:
    """Build Google credentials from tokens stored in Supabase, refresh if needed."""
    row = supabase.table("users").select("*").eq("email", email).execute().data
    if not row:
        raise ValueError(f"{email} is not authorized.")
    u = row[0]
    creds = Credentials(
        token=u["access_token"],
        refresh_token=u["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=GOOGLE_SCOPES,
    )
    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())
        supabase.table("users").update({
            "access_token": creds.token,
            "token_expiry": creds.expiry.isoformat() if creds.expiry else None,
        }).eq("email", email).execute()
    return creds

def _slot_window_bounds(date_str: str, slot_window: str, tz_name: str) -> Tuple[datetime, datetime]:
    """Return the local start/end datetimes for the chosen window on the given day."""
    # Force everything to Asia/Kolkata
    if tz_name.lower() in ["asia/calcutta", "calcutta", "kolkata", "india", "ist"]:
        tz_name = "Asia/Kolkata"

    tz = ZoneInfo(tz_name)
    y, m, d = map(int, date_str.split("-"))
    if slot_window == "after_lunch":
        start_local = datetime(y, m, d, 13, 30, tzinfo=tz)
        end_local   = datetime(y, m, d, 18, 0,  tzinfo=tz)
    else:  # before_lunch
        start_local = datetime(y, m, d, 9, 0,  tzinfo=tz)
        end_local   = datetime(y, m, d, 12, 30, tzinfo=tz)
    return start_local, end_local

def _freebusy(service, start_dt_local: datetime, end_dt_local: datetime, tz_name: str) -> List[Dict]:
    """Call Google FreeBusy API for the primary calendar within the given window."""
    body = {
        "timeMin": start_dt_local.astimezone(timezone.utc).isoformat(),
        "timeMax": end_dt_local.astimezone(timezone.utc).isoformat(),
        "timeZone": tz_name,
        "items": [{"id": "primary"}],
    }
    resp = service.freebusy().query(body=body).execute()
    return resp["calendars"]["primary"]["busy"]

def _round_up_to_quarter(dt: datetime) -> datetime:
    """Round datetime up to the next 15-min slot."""
    discard = dt.minute % 15
    if discard == 0 and dt.second == 0 and dt.microsecond == 0:
        return dt
    return (dt.replace(second=0, microsecond=0, minute=dt.minute - discard) + timedelta(minutes=15))

def _find_first_free_gap(
    busy_intervals_utc: List[Tuple[datetime, datetime]],
    window_start_utc: datetime,
    window_end_utc: datetime,
    duration_minutes: int,
) -> Tuple[datetime, datetime] | Tuple[None, None]:
    """Find the first free gap starting *after now* and aligned to 15-min slots."""
    now_utc = datetime.now(timezone.utc)

    # Start at max(window_start, now), rounded up to 15-min boundary
    cur = _round_up_to_quarter(max(window_start_utc, now_utc))
    need = timedelta(minutes=duration_minutes)

    # Clip busy intervals to window
    intervals = []
    for s, e in busy_intervals_utc:
        if e <= window_start_utc or s >= window_end_utc:
            continue
        intervals.append((max(s, window_start_utc), min(e, window_end_utc)))
    intervals.sort(key=lambda x: x[0])

    for s, e in intervals:
        # If there's a free gap between cur and this busy start
        if s - cur >= need:
            return cur, cur + need
        if e > cur:
            cur = _round_up_to_quarter(e)

    if window_end_utc - cur >= need:
        return cur, cur + need

    return None, None


def schedule_meeting(
    participants_emails: List[str],
    date_str: str,
    duration_minutes: int,
    slot_window: str,
    summary: str,
    timezone_name: str = "UTC",
    organizer_email: str | None = None,
):
    """Find first common free slot and create a Google Meet event."""
    if organizer_email is None:
        organizer_email = participants_emails[0]

    # Build services and collect busy blocks
    start_local, end_local = _slot_window_bounds(date_str, slot_window, timezone_name)
    window_start_utc = start_local.astimezone(timezone.utc)
    window_end_utc   = end_local.astimezone(timezone.utc)

    all_busy_utc: List[Tuple[datetime, datetime]] = []
    services: Dict[str, any] = {}

    for email in participants_emails:
        creds = _creds_for(email)
        service = build("calendar", "v3", credentials=creds)
        services[email] = service

        busy_blocks = _freebusy(service, start_local, end_local, timezone_name)
        for b in busy_blocks:
            s = datetime.fromisoformat(b["start"].replace("Z", "+00:00")).astimezone(timezone.utc)
            e = datetime.fromisoformat(b["end"].replace("Z", "+00:00")).astimezone(timezone.utc)
            all_busy_utc.append((s, e))

    slot_start, slot_end = _find_first_free_gap(all_busy_utc, window_start_utc, window_end_utc, duration_minutes)
    if not slot_start:
        raise ValueError("No common free slot found in the selected window.")

    organizer_service = services.get(organizer_email) or build("calendar", "v3", credentials=_creds_for(organizer_email))

    event = {
        "summary": summary,
        "start": {"dateTime": slot_start.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": slot_end.isoformat(), "timeZone": "UTC"},
        "attendees": [{"email": e} for e in participants_emails],
        "conferenceData": {"createRequest": {"requestId": f"meet-{int(datetime.now(tz=timezone.utc).timestamp())}"}},
    }

    created = organizer_service.events().insert(
        calendarId="primary",
        body=event,
        conferenceDataVersion=1,
        sendUpdates="all",
    ).execute()

    return {
        "event_id": created["id"],
        "htmlLink": created.get("htmlLink"),
        "hangoutLink": created.get("hangoutLink"),
        "start": created["start"],
        "end": created["end"],
    }
