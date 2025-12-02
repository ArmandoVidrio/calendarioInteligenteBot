# main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from google_auth_oauthlib.flow import Flow
import os

app = FastAPI()

# Load OAuth settings
GOOGLE_CLIENT_SECRETS = "credentials.json"
REDIRECT_URI = "http://localhost:3002/auth/callback"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar"
]

## Get URL to login in ago
@app.get("/auth/login")
def google_login():
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRETS,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    
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
