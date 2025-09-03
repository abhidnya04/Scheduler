from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List
from google_auth_oauthlib.flow import Flow
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Google OAuth flow
client_id = os.getenv("GOOGLE_CLIENT_ID")
client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

@app.get("/")
def home():
    return {"message": "Welcome to Calendly Clone"}

@app.get("/auth/google")
def auth_google():
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=["https://www.googleapis.com/auth/calendar.events"]
    )
    flow.redirect_uri = redirect_uri
    auth_url, _ = flow.authorization_url(prompt="consent")
    return RedirectResponse(auth_url)



@app.get("/auth/callback")
async def auth_callback(request: Request):
    code = request.query_params.get("code")
    if not code:
        return {"error": "No code provided"}

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=["https://www.googleapis.com/auth/calendar.events"]
    )
    flow.redirect_uri = redirect_uri

    flow.fetch_token(code=code)

    credentials = flow.credentials

    # ✅ redirect to frontend page with token
    frontend_url = f"http://localhost:5173/schedule?token={credentials.token}"
    return RedirectResponse(frontend_url)


class MeetingRequest(BaseModel):
    emails: List[str]
    date: str           # "YYYY-MM-DD"
    slot_window: str    # "before_lunch" or "after_lunch"
    duration: int       # 30, 45, 60
    title: str

@app.post("/meetings/find-slot")
async def find_slot(meeting: MeetingRequest):
    """
    Phase 1: Just validate payload.
    Later in Phase 2, we’ll check availability with Google Calendar.
    """
    return {
        "status": "received",
        "meeting": meeting.dict()
    }