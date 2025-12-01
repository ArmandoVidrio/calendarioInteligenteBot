# main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from google_auth_oauthlib.flow import Flow
import os
import logging
from urllib.parse import urlencode
import secrets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

app = FastAPI()

# Load OAuth settings
GOOGLE_CLIENT_SECRETS = "credentials.json"
REDIRECT_URI = "https://ontogenetical-jaylin-unwhirled.ngrok-free.dev"
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.readonly"
]

def build_google_auth_url(state: str):
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/calendar",
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": state,
        "prompt": "consent"
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"

@app.get("/auth/login")
def google_login():
    state = secrets.token_urlsafe(16)
    auth_url = build_google_auth_url(state)
    logger.info(f"Generated Google OAuth URL: {auth_url}")
    logger.info(f"State parameter: {state}")
    return {"login_url": auth_url, "state": state}


@app.get("/auth/callback")
async def google_callback(request: Request):
    code = request.query_params.get("code")

    if not code:
        return JSONResponse({"error": "Missing code"}, status_code=400)

    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRETS,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    flow.fetch_token(code=code)

    credentials = flow.credentials

    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "expires_in": credentials.expiry.isoformat(),
        "scopes": credentials.scopes,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
