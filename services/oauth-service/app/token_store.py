import json
import os
from typing import Optional
from google.oauth2.credentials import Credentials
from app.config import SCOPES, TOKENS_FILE


def load_store() -> dict:
    if not os.path.exists(TOKENS_FILE):
        return {}
    with open(TOKENS_FILE, "r") as f:
        return json.load(f)


def save_store(store: dict):
    tmp = TOKENS_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(store, f, indent=2)
    os.replace(tmp, TOKENS_FILE)


def save_user_credentials(user_id: str, creds: Credentials):
    store = load_store()
    store[user_id] = json.loads(creds.to_json())
    save_store(store)


def get_user_credentials(user_id: str) -> Optional[Credentials]:
    store = load_store()
    data = store.get(user_id)
    if not data:
        return None
    return Credentials.from_authorized_user_info(data, SCOPES)
