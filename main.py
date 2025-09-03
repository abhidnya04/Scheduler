# main.py
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from google_auth_oauthlib.flow import Flow
import os, smtplib, urllib.parse
from email.mime.text import MIMEText
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta
import uuid


load_dotenv()

app = FastAPI()

# CORS so frontend can call backend
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
origins = [FRONTEND_URL]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Google / OAuth config
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
SCOPES = [os.getenv("GOOGLE_SCOPES", "https://www.googleapis.com/auth/calendar.events")]

# SMTP config
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)

#supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # use service role key in backend only
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# small helper to build Flow config
def client_config():
    return {
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }

def send_email_sync(recipient: str, subject: str, html_body: str):
    try:
        msg = MIMEText(html_body, "html")
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = recipient

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(EMAIL_FROM, [recipient], msg.as_string())

        print(f"✅ Email sent to {recipient}")
    except Exception as e:
        print(f"❌ Failed to send email to {recipient}: {e}")

    
# Request model for sending invites
class InviteRequest(BaseModel):
    emails: List[EmailStr]
    # optional meeting context (you may include in the email)
    title: Optional[str] = None
    date: Optional[str] = None
    duration: Optional[int] = None
    slot_window: Optional[str] = None
  



@app.get("/")
def home():
    return {"message": "Calendly Clone"}

@app.get("/auth/google")
async def auth_google(state: Optional[str] = None):
    flow = Flow.from_client_config(client_config(), scopes=SCOPES)
    flow.redirect_uri = REDIRECT_URI

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state
    )
    return RedirectResponse(auth_url)


@app.post("/invites/send")
async def send_invites(req: InviteRequest, background_tasks: BackgroundTasks):
    """
    For each email: build a Google OAuth URL with state=<urlencoded email>,
    then send the link via email (in background).
    """
    results = []



    for email in req.emails:
        existing = supabase.table("users").select("id").eq("email", email).execute()
        if existing.data:  # already authorized
            results.append({"email": email, "status": "already_authorized"})
            continue  # skip sending OAuth email
        # create Flow and authorization URL, store email in `state`
        flow = Flow.from_client_config(client_config(), scopes=SCOPES)
        flow.redirect_uri = REDIRECT_URI
        state = urllib.parse.quote_plus(email)   # put the invitee email in state
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state
        )

        invite_link = f"{BACKEND_BASE_URL}/auth/google?state={state}"


        # build email body (you can include meeting details)
        # build email body (you can include meeting details)
        body = f"""
        <p>Hi,</p>
        <p>You have been invited to join <b>Schedulr</b>, a meeting scheduler.</p>
        <p>To participate and allow the host to check your availability, please grant access to your Google Calendar.</p>
        <p>
           <a href="{invite_link}" 
            style="display:inline-block;
            padding:12px 20px;
            background-color:#1a73e8;
            color:#ffffff;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;">
            Grant Google Calendar Access
        </a>
        </p>
        <p>If you don’t want to participate, you can safely ignore this email.</p>
        """


        # send email in background
        background_tasks.add_task(send_email_sync, email, "Calendar access request", body)
        # save invite record in Supabase
        supabase.table("invites").insert({
            "email": email,

            "status": "pending"
        }).execute()

        results.append({"email": email, "status": "queued"})

    return {"results": results}



@app.get("/auth/callback")
async def auth_callback(request: Request):
    code = request.query_params.get("code")
    state = request.query_params.get("state")  # encoded invitee email
    if not code:
        return JSONResponse({"error": "no code provided"}, status_code=400)

    flow = Flow.from_client_config(client_config(), scopes=SCOPES)
    flow.redirect_uri = REDIRECT_URI
    flow.fetch_token(code=code)
    credentials = flow.credentials

    invited_email = urllib.parse.unquote_plus(state) if state else ""

    # Upsert user in Supabase (unique id auto-generated)
    supabase.table("users").upsert({
        "email": invited_email,
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_expiry": credentials.expiry.isoformat()
    }, on_conflict="email").execute()

    # Fetch unique user id
    user_data = supabase.table("users").select("id").eq("email", invited_email).execute()
    user_id = user_data.data[0]["id"] if user_data.data else None

    # Redirect to frontend with authorized email AND user_id
    redirect_url = f"{FRONTEND_URL}/schedule?authorized={urllib.parse.quote_plus(invited_email)}&user_id={user_id}"
    return RedirectResponse(redirect_url)

class ScheduleMeetingRequest(BaseModel):
    title: str
    date: str
    duration: int
    host_email: EmailStr

@app.post("/meetings/schedule")
async def schedule_meeting(req: ScheduleMeetingRequest):
    # Fetch all invites for this host
    invites_data = supabase.table("invites").select("*").eq("host_email", req.host_email).execute()
    invites = invites_data.data

    # Check if all are authorized
    if not invites or any(inv["status"] != "authorized" for inv in invites):
        return JSONResponse({"error": "Not all members are authorized yet"}, status_code=400)

    # Get host user_id
    host_data = supabase.table("users").select("id").eq("email", req.host_email).execute()
    if not host_data.data:
        return JSONResponse({"error": "Host not found"}, status_code=400)
    host_user_id = host_data.data[0]["id"]

    # Create meeting
    meeting = supabase.table("meetings").insert({
        "user_id": host_user_id,
        "title": req.title,
        "start_time": datetime.fromisoformat(req.date + "T09:00:00").isoformat(),
        "end_time": (datetime.fromisoformat(req.date + "T09:00:00") + timedelta(minutes=req.duration)).isoformat()
    }).execute()

    meeting_id = meeting.data[0]["id"]

    

    return {"message": "Meeting scheduled", "meeting_id": meeting_id}
