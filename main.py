# # main.py
# from fastapi import FastAPI, Request, BackgroundTasks
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import RedirectResponse, JSONResponse
# from pydantic import BaseModel, EmailStr
# from typing import List, Optional
# from google_auth_oauthlib.flow import Flow
# import os, smtplib, urllib.parse
# from email.mime.text import MIMEText
# from dotenv import load_dotenv
# from supabase import create_client, Client
# from datetime import datetime, timedelta
# import uuid


# load_dotenv()

# app = FastAPI()

# # CORS so frontend can call backend
# FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
# origins = [FRONTEND_URL]
# app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# # Google / OAuth config
# CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
# CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
# SCOPES = os.getenv("GOOGLE_SCOPES").split()


# # SMTP config
# SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
# SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
# SMTP_USER = os.getenv("SMTP_USER")
# SMTP_PASS = os.getenv("SMTP_PASS")
# EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)

# #supabase
# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # use service role key in backend only
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# # small helper to build Flow config
# def client_config():
#     return {
#         "web": {
#             "client_id": CLIENT_ID,
#             "client_secret": CLIENT_SECRET,
#             "auth_uri": "https://accounts.google.com/o/oauth2/auth",
#             "token_uri": "https://oauth2.googleapis.com/token",
#             "redirect_uris": [REDIRECT_URI],
#         }
#     }

# def send_email_sync(recipient: str, subject: str, html_body: str):
#     try:
#         msg = MIMEText(html_body, "html")
#         msg["Subject"] = subject
#         msg["From"] = EMAIL_FROM
#         msg["To"] = recipient

#         with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
#             server.starttls()
#             server.login(SMTP_USER, SMTP_PASS)
#             server.sendmail(EMAIL_FROM, [recipient], msg.as_string())

#         print(f"✅ Email sent to {recipient}")
#     except Exception as e:
#         print(f"❌ Failed to send email to {recipient}: {e}")

    
# # Request model for sending invites
# class InviteRequest(BaseModel):
#     host_email: EmailStr
#     emails: List[EmailStr]
#     # optional meeting context (you may include in the email)
#     title: Optional[str] = None
#     date: Optional[str] = None
#     duration: Optional[int] = None
#     slot_window: Optional[str] = None
  



# @app.get("/")
# def home():
#     return {"message": "Calendly Clone"}

# @app.get("/auth/google")
# async def auth_google(email: str):
#     flow = Flow.from_client_config(client_config(), scopes=SCOPES)
#     flow.redirect_uri = REDIRECT_URI
#     state = urllib.parse.quote_plus(email)

#     auth_url, _ = flow.authorization_url(
#         access_type="offline",
#         include_granted_scopes="true",
#         prompt="consent",
#         state=state
#     )
#     return RedirectResponse(auth_url)


# @app.post("/invites/send")
# async def send_invites(req: InviteRequest, background_tasks: BackgroundTasks):
#     """
#     For each email: build a Google OAuth URL with state=<urlencoded email>,
#     then send the link via email (in background).
#     """
#     results = []



#     for email in req.emails:
#         existing = supabase.table("users").select("id").eq("email", email).execute()
#         if existing.data:  # already authorized
#             results.append({"email": email, "status": "already_authorized"})
#             continue  # skip sending OAuth email
#         # create Flow and authorization URL, store email in `state`
#         flow = Flow.from_client_config(client_config(), scopes=SCOPES)
#         flow.redirect_uri = REDIRECT_URI
#         state = urllib.parse.quote_plus(email)   # put the invitee email in state
#         auth_url, _ = flow.authorization_url(
#             access_type="offline",
#             include_granted_scopes="true",
#             prompt="consent",
#             state=state
#         )

#         invite_link = f"{BACKEND_BASE_URL}/auth/google?email={urllib.parse.quote_plus(email)}"



#         # build email body (you can include meeting details)
#         # build email body (you can include meeting details)
#         body = f"""
#         <p>Hi,</p>
#         <p>You have been invited to join <b>Schedulr</b>, a meeting scheduler.</p>
#         <p>To participate and allow the host to check your availability, please grant access to your Google Calendar.</p>
#         <p>
#            <a href="{invite_link}" 
#             style="display:inline-block;
#             padding:12px 20px;
#             background-color:#1a73e8;
#             color:#ffffff;
#             text-decoration:none;
#             border-radius:6px;
#             font-weight:bold;">
#             Grant Google Calendar Access
#         </a>
#         </p>
#         <p>If you don’t want to participate, you can safely ignore this email.</p>
#         """


#         # send email in background
#         background_tasks.add_task(send_email_sync, email, "Calendar access request", body)
#         # save invite record in Supabase
#         supabase.table("invites").insert({
#             "email": email,
#             "host_email": req.host_email,
#             "status": "pending"
#         }).execute()

#         results.append({"email": email, "status": "queued"})

#     return {"results": results}



# @app.get("/auth/callback")
# async def auth_callback(request: Request):
#     code = request.query_params.get("code")
#     email = request.query_params.get("state")

#     if email:
#         email = urllib.parse.unquote_plus(email)

#     if not code:
#         return JSONResponse({"error": "no code provided"}, status_code=400)

#     flow = Flow.from_client_config(client_config(), scopes=SCOPES)
#     flow.redirect_uri = REDIRECT_URI
#     flow.fetch_token(code=code)
#     credentials = flow.credentials


#     # Upsert user in Supabase (unique id auto-generated)
#     supabase.table("users").upsert({
#         "email": email,
#         "access_token": credentials.token,
#         "refresh_token": credentials.refresh_token,
#         "token_expiry": credentials.expiry.isoformat()
#     }, on_conflict="email").execute()


#     # Fetch unique user id
#     user_data = supabase.table("users").select("id").eq("email", email).execute()
#     user_id = user_data.data[0]["id"] if user_data.data else None

#     # Redirect to frontend with authorized email AND user_id
#     redirect_url = f"{FRONTEND_URL}/schedule?authorized={urllib.parse.quote_plus(email)}&user_id={user_id}"
#     return RedirectResponse(redirect_url)

# class ScheduleMeetingRequest(BaseModel):
#     title: str
#     date: str
#     duration: int
#     host_email: EmailStr

# @app.post("/meetings/schedule")
# async def schedule_meeting(req: ScheduleMeetingRequest):
#     # Fetch all invites for this host
#     invites_data = supabase.table("invites").select("*").eq("host_email", req.host_email).execute()
#     invites = invites_data.data

#     # Check if all are authorized
#     if not invites or any(inv["status"] != "authorized" for inv in invites):
#         return JSONResponse({"error": "Not all members are authorized yet"}, status_code=400)

#     # Get host user_id
#     host_data = supabase.table("users").select("id").eq("email", req.host_email).execute()
#     if not host_data.data:
#         return JSONResponse({"error": "Host not found"}, status_code=400)
#     host_user_id = host_data.data[0]["id"]

#     # Create meeting
#     meeting = supabase.table("meetings").insert({
#         "user_id": host_user_id,
#         "title": req.title,
#         "start_time": datetime.fromisoformat(req.date + "T09:00:00").isoformat(),
#         "end_time": (datetime.fromisoformat(req.date + "T09:00:00") + timedelta(minutes=req.duration)).isoformat()
#     }).execute()

#     meeting_id = meeting.data[0]["id"]

    

#     return {"message": "Meeting scheduled", "meeting_id": meeting_id}








from fastapi import FastAPI, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv
import os
from supabase import create_client
from datetime import datetime
from pydantic import BaseModel,  EmailStr
from email.mime.text import MIMEText
import smtplib
from scheduler import schedule_meeting as schedule_meeting_core

import urllib.parse
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

app = FastAPI()


#lets frontend talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"] for security
    allow_methods=["*"],  # allow all HTTP methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],
)


# Allow HTTP for localhost (do NOT use in production)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# Google OAuth credentials from .env
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")  # e.g., http://127.0.0.1:8000/auth/google/callback

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")

# OAuth scopes
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email", #access to users email address (store in supabase to identify authorized/unauthorized)
    "https://www.googleapis.com/auth/userinfo.profile", #acess to userinfo(name,profile picture,..)
    "https://www.googleapis.com/auth/calendar.events",  #acess to calender events# read/write calendar events
    "https://www.googleapis.com/auth/calendar", 
    "https://www.googleapis.com/auth/meetings.space.created", #create google meet without needing to create calender event
]



# Route to start Google login
@app.get("/auth/google")
def google_login(invitee_email: str = Query(None)):
    flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",#where to send user for login/consent.
                    "token_uri": "https://oauth2.googleapis.com/token",#where to exchange the code for tokens.
                    "redirect_uris": [REDIRECT_URI] #after login it will send to this url(google/callback)
                }
            },
            scopes=SCOPES,#will show permissions you are asking for(calender,email,..)
            redirect_uri=REDIRECT_URI
        )

    # generates google consent/login url
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        # prompt="consent"  # asks for consent each time user logs in
    )

      # Append the invitee_email to state or redirect URL
    if invitee_email:
        authorization_url += f"&invitee_email={urllib.parse.quote_plus(invitee_email)}"

    return RedirectResponse(authorization_url)


# Callback route after Google login(where to go after login(granting permissions))
@app.get("/auth/callback")
def google_callback(request: Request):
    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            },
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )

        # Exchange code for tokens
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials

        access_token = credentials.token
        refresh_token = credentials.refresh_token
        token_expiry = credentials.expiry

        # Get user info from Google
        import requests
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            params={"alt": "json"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_info = resp.json() # Converts the JSON response into a Python dictionary.
        email = user_info.get("email")

        if not email:
            return {"error": "Could not retrieve email from Google."}
        
        token_expiry_str = token_expiry.isoformat() if token_expiry else None
        # Prepare data for Supabase
        data = {
            "email": email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_expiry": token_expiry_str,
        }

        # upsert -> Insert or update user in Supabase
        result = supabase.table("users").upsert(data, on_conflict="email").execute()

       # Check for errors

        print("Supabase upsert result:", result.data)

         # Fetch the user's Supabase ID
        user_data = supabase.table("users").select("id").eq("email", email).execute()
        user_id = user_data.data[0]["id"] if user_data.data else ""

        # Build redirect URL to frontend dashboard page
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        redirect_url = f"{frontend_url}/dashboard?authorized={urllib.parse.quote_plus(email)}&user_id={user_id}"

        return RedirectResponse(redirect_url)

    except Exception as e:
        print("Callback error:", str(e))
        return {"error": "Google login callback failed", "details": str(e)}

class InvitePayload(BaseModel):
    emails: list[str]
    title: str
    date: str
    duration: int
    slot_window: str
    host_email: str

@app.post("/invites/send")
def send_invites(payload: InvitePayload):
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = os.getenv("SMTP_PORT")
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASS = os.getenv("SMTP_PASS")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    for email in payload.emails:
        register_link = f"{BACKEND_BASE_URL}/auth/google?invitee_email={email}"
        body = f"""
        Hi {email},

        You have been invited by {payload.host_email} to join the scheduler.

        Click here to register: {register_link}

        Meeting: {payload.title} on {payload.date} ({payload.duration} min)
        """
        msg = MIMEText(body) # MIMEText converts the body to a proper email format.
        msg["Subject"] = f"Invite to {payload.title}" #Sets subject, from, and to fields.
        msg["From"] = SMTP_USER
        msg["To"] = email

        try:
            #SMTP() → connects to your email server.
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls() # encrypts the connection (secure).
                server.login(SMTP_USER, SMTP_PASS) # authenticate with email credentials.
                server.sendmail(SMTP_USER, email, msg.as_string()) # sends the email.
        except Exception as e:
            print(f"Failed to send email to {email}: {e}")

    return {"message": "Invites sent successfully"}    

@app.get("/users/by-email")
def get_user_by_email(email: str):
    # Query Supabase for user with this email
    user_data = supabase.table("users").select("email").eq("email", email).execute()
    if user_data.data:
        return {"email": user_data.data[0]["email"]}
    return {"email": None}

@app.get("/users/{user_id}")
def get_user(user_id: str):
    user_data = supabase.table("users").select("email").eq("id", user_id).execute()
    if user_data.data:
        return {"email": user_data.data[0]["email"]}
    return {"email": None}


class ScheduleBody(BaseModel):
    emails: list[EmailStr]        # invitees (no host here)
    title: str
    date: str                     # "YYYY-MM-DD"
    duration: int                 # minutes
    slot_window: str              # "before_lunch" | "after_lunch"
    host_email: EmailStr
    timezone: str | None = "Asia/Kolkata"  # e.g. "Asia/Kolkata", "America/New_York"

@app.post("/schedule-meeting")
def schedule_meeting_api(body: ScheduleBody):
    # Combine host + invitees
    participants = list({body.host_email, *[e for e in body.emails]})

    # Quick server-side safety check: ensure everyone is authorized in Supabase
    for e in participants:
        exists = supabase.table("users").select("id").eq("email", e).execute().data
        if not exists:
            return JSONResponse(status_code=400, content={"error": f"{e} is not authorized."})

    try:
        result = schedule_meeting_core(
            participants_emails=participants,
            date_str=body.date,
            duration_minutes=body.duration,
            slot_window=body.slot_window,
            summary=body.title,
            timezone_name=body.timezone or "UTC",
            organizer_email=body.host_email,
        )
        
        # Save meeting to database
        if result and result.get("hangoutLink"):
            # Get organizer user_id
            organizer_data = supabase.table("users").select("id").eq("email", body.host_email).execute()
            organizer_user_id = organizer_data.data[0]["id"] if organizer_data.data else None
            
            # Calculate start and end times (assuming 9 AM start for now - you can modify this)
            from datetime import datetime, timedelta
            start_time = datetime.fromisoformat(body.date + "T09:00:00")
            end_time = start_time + timedelta(minutes=body.duration)
            
            # Insert meeting
            meeting_data = {
                "title": body.title,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_minutes": body.duration,
                "organizer_email": body.host_email,
                "organizer_user_id": organizer_user_id,
                "hangout_link": result.get("hangoutLink"),
                "timezone": body.timezone or "UTC"
            }
            
            meeting_result = supabase.table("meetings").insert(meeting_data).execute()
            meeting_id = meeting_result.data[0]["id"] if meeting_result.data else None
            
            # Insert participants
            if meeting_id:
                participant_data = []
                for email in participants:
                    # Get participant user_id if exists
                    participant_user_data = supabase.table("users").select("id").eq("email", email).execute()
                    participant_user_id = participant_user_data.data[0]["id"] if participant_user_data.data else None
                    
                    participant_data.append({
                        "meeting_id": meeting_id,
                        "participant_email": email,
                        "participant_user_id": participant_user_id,
                        "status": "accepted" if email == body.host_email else "invited"
                    })
                
                if participant_data:
                    supabase.table("meeting_participants").insert(participant_data).execute()
        
        return result
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


# Endpoint for dashboard to list upcoming meetings
@app.get("/meetings/upcoming")
def get_upcoming_meetings(user_id: str):
    try:
        from datetime import datetime
        
        print(f"Fetching meetings for user_id: {user_id}")
        
        # Simple approach: get all meetings where user is organizer
        meetings_query = supabase.table("meetings").select("*").eq("organizer_user_id", user_id).gte("start_time", datetime.now().isoformat()).order("start_time").execute()
        
        print(f"Found {len(meetings_query.data)} meetings")
        
        meetings = []
        for meeting in meetings_query.data:
            # Get participants for this meeting
            participants_query = supabase.table("meeting_participants").select("participant_email, status").eq("meeting_id", meeting["id"]).execute()
            
            meetings.append({
                "id": meeting["id"],
                "title": meeting["title"],
                "start_time": meeting["start_time"],
                "end_time": meeting["end_time"],
                "duration": meeting["duration_minutes"],
                "hangout_link": meeting["hangout_link"],
                "organizer_email": meeting["organizer_email"],
                "participants": [{"email": p["participant_email"], "status": p["status"]} for p in participants_query.data]
            })
        
        print(f"Returning {len(meetings)} meetings")
        return meetings
    except Exception as e:
        print(f"Error fetching meetings: {e}")
        import traceback
        traceback.print_exc()
        return []