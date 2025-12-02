from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from app.config import CREDENTIALS_FILE, REDIRECT_URI, SCOPES
from google.oauth2.credentials import Credentials


def build_flow(state: str = None):
    flow = Flow.from_client_secrets_file(
        client_secrets_file=CREDENTIALS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    flow.oauth2session.params["access_type"] = "offline"
    flow.oauth2session.params["prompt"] = "consent"

    if state:
        flow.params = {"state": state}
    return flow


def refresh_if_needed(creds: Credentials) -> Credentials:
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    return creds
