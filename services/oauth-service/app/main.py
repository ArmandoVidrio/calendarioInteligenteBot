# main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from google_auth_oauthlib.flow import Flow
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Load OAuth settings
GOOGLE_CLIENT_SECRETS = "credentials.json"
REDIRECT_URI = "https://ontogenetical-jaylin-unwhirled.ngrok-free.dev/auth/callback"

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar"
]

## Get URL to login in ago
@app.get("/auth/login")
def google_login():
    # Crear flujo OAuth con tu credentials.json y redirect URI correcto
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRETS,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    
    # Genera la URL de autorización
    auth_url, state = flow.authorization_url(
        access_type="offline",           # Para obtener refresh token
        include_granted_scopes="true",   # Para no pedir permisos repetidos
        prompt="consent"                 # Fuerza la pantalla de consentimiento
    )
    
    logger.info(f"Generated Google OAuth URL: {auth_url}")
    logger.info(f"State parameter: {state}")
    
    return {"login_url": auth_url, "state": state}


@app.get("/auth/callback")
async def google_callback(request: Request):
    print("Callback received")
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
