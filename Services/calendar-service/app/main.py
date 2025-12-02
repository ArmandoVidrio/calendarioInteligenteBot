# main.py
# Calendar service with OAuth2 Web Server Flow for Google Calendar (Option A)
import os
import json
import logging
import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("calendar-service")

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/calendar.events"]  # adjust scopes
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
TOKENS_FILE = os.getenv("TOKENS_STORE_FILE", "user_tokens.json")
# BASE_URL should be reachable by the user's browser (where Google will redirect)
BASE_URL = os.getenv("BASE_URL", "http://localhost:3001")
REDIRECT_PATH = "/auth/google/callback"
REDIRECT_URI = BASE_URL.rstrip("/") + REDIRECT_PATH

# -----------------------------------------------------------------------------
# FastAPI app
# -----------------------------------------------------------------------------
app = FastAPI(title="Calendar Service (Google OAuth)",
              description="Handles user OAuth to Google Calendar and serves events")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Simple token storage (file based). Replace by DB in prod.
# -----------------------------------------------------------------------------
def load_tokens_store() -> dict:
    try:
        if not os.path.exists(TOKENS_FILE):
            return {}
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load tokens store: {e}")
        return {}

def save_tokens_store(store: dict):
    tmp = TOKENS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)
    os.replace(tmp, TOKENS_FILE)

def save_credentials_for_user(user_id: str, creds: Credentials):
    store = load_tokens_store()
    store[str(user_id)] = json.loads(creds.to_json())
    save_tokens_store(store)
    logger.info(f"Saved credentials for user {user_id}")

def get_credentials_for_user(user_id: str) -> Optional[Credentials]:
    store = load_tokens_store()
    data = store.get(str(user_id))
    if not data:
        return None
    # data is the dict representation created by creds.to_json()
    return Credentials.from_authorized_user_info(data, SCOPES)


@app.get("/health")
async def health():
    logger.info("Health check called")
    return {"status": "healthy", "service": "calendar-service"}

@app.get("/")
async def root():
    return {"message": "Calendar service running. Use /auth/google/url to start OAuth."}

@app.get("/auth/google/url")
async def get_auth_url(user_id: str):
    """
    Returns an authorization URL the user should open in the browser.
    Query param: user_id (e.g. telegram_user_id) which will be put into `state`
    """
    logger.info(f"Generating auth URL for user_id={user_id}")
    try:
        flow = build_flow(state=str(user_id))
        auth_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent"
        )
        # state returned here equals the value we passed (user_id)
        logger.info(f"Auth URL generated for user {user_id} (state={state})")
        return {"auth_url": auth_url, "state": state}
    except FileNotFoundError as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create auth URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to create auth URL")

@app.get("/auth/google/callback", response_class=HTMLResponse)
async def auth_callback(request: Request):
    """
    OAuth callback endpoint where Google redirects with ?code=...&state=...
    We exchange the code for tokens and save them associated with state (telegram user id).
    """
    logger.info("OAuth callback called")
    # full URL that Google redirected to (required for fetch_token)
    full_url = str(request.url)
    logger.info(f"Callback URL: {full_url}")
    # extract state to know which user this belongs to
    state = request.query_params.get("state")
    if not state:
        logger.error("Missing state in callback")
        raise HTTPException(status_code=400, detail="Missing state parameter")

    try:
        flow = build_flow(state=state)
        # Important: pass the full URL to fetch_token
        flow.fetch_token(authorization_response=full_url)
        creds = flow.credentials
        # Save credentials for this user
        save_credentials_for_user(state, creds)
        logger.info(f"OAuth successful for user {state}")
        # Simple HTML response to inform the user they can return to Telegram
        html = "<html><body><h2>Google Calendar connected successfully. You can return to the Telegram bot.</h2></body></html>"
        return HTMLResponse(content=html, status_code=200)
    except Exception as e:
        logger.error(f"Error exchanging token: {e}")
        raise HTTPException(status_code=500, detail=f"Error exchanging token: {e}")

@app.get("/calendar/events")
async def get_upcoming_events(user_id: str, max_results: int = 10):
    """
    Return upcoming events for a user (identified by user_id).
    The server will refresh tokens if expired.
    """
    logger.info(f"Getting upcoming events for user {user_id}")
    creds = get_credentials_for_user(user_id)
    if not creds:
        logger.warning(f"No credentials found for user {user_id}")
        raise HTTPException(status_code=404, detail="User not authorized. Start OAuth via /auth/google/url")

    try:
        # Refresh if needed
        if not creds.valid:
            if creds.expired and creds.refresh_token:
                logger.info(f"Refreshing credentials for user {user_id}")
                creds.refresh(GoogleRequest())
                # Persist refreshed tokens
                save_credentials_for_user(user_id, creds)
            else:
                logger.warning(f"Credentials invalid and cannot refresh for user {user_id}")
                raise HTTPException(status_code=401, detail="Credentials invalid. Re-authenticate.")

        service = build("calendar", "v3", credentials=creds)

        now = datetime.datetime.utcnow().isoformat() + "Z"
        logger.info(f"Fetching events since {now}")
        events_result = service.events().list(
            calendarId="primary",
            timeMin=now,
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime"
        ).execute()

        events = events_result.get("items", [])
        logger.info(f"Returning {len(events)} events for user {user_id}")
        return {"events": events}
    except HttpError as err:
        logger.error(f"Google API error for user {user_id}: {err}")
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as e:
        logger.error(f"Unexpected error fetching events for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------------------------------------------------------
# Run (dev)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 3001)), log_level="info")
