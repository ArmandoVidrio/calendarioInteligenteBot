import os

BASE_URL = os.getenv("BASE_URL", "http://localhost:5000")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events"
]

CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
TOKENS_FILE = os.getenv("TOKENS_STORE_FILE", "user_tokens.json")

REDIRECT_PATH = "/auth/google/callback"
REDIRECT_URI = BASE_URL.rstrip("/") + REDIRECT_PATH
