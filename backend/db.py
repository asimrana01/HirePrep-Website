"""
db.py — Firestore data access layer for HirePrep.

Uses Cloud Firestore for all persistence (users and results).
CV PDFs are parsed locally and then discarded — only the extracted text
and structured data are stored in Firestore. Firebase Storage is not used,
so no paid Storage plan is required.

Initialization supports two paths:
  1. Local dev: GOOGLE_APPLICATION_CREDENTIALS env var points to a
     downloaded service account JSON file on disk.
  2. Render (or any host where you can't easily mount a file): the full
     JSON contents of the service account key are pasted into a single
     env var, FIREBASE_SERVICE_ACCOUNT_JSON, and we parse it in memory.
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

# ─── Initialize Firebase Admin ──────────────────────────────────────────────
_firebase_app = None

def init_firebase():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if service_account_json:
        # Render-style: full JSON pasted into one env var
        cred_dict = json.loads(service_account_json)
        cred = credentials.Certificate(cred_dict)
    else:
        # Local-style: GOOGLE_APPLICATION_CREDENTIALS points to a file path
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path or not os.path.exists(cred_path):
            raise RuntimeError(
                "Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS "
                "to a service account JSON file path (local dev), or set "
                "FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON contents (Render)."
            )
        cred = credentials.Certificate(cred_path)

    # No storageBucket needed — we don't use Firebase Storage
    _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app


init_firebase()
db = firestore.client()

USERS_COLLECTION   = "users"
RESULTS_COLLECTION = "results"


# ══════════════════════════════════════════════════════════════════════════
# USERS
# ══════════════════════════════════════════════════════════════════════════

def get_user(user_id):
    """Fetch a single user document by id. Returns dict or None."""
    if not user_id:
        return None
    doc = db.collection(USERS_COLLECTION).document(user_id).get()
    return doc.to_dict() if doc.exists else None


def get_user_by_email(email):
    """Fetch a user document by email field. Returns dict or None."""
    query = db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).stream()
    for doc in query:
        return doc.to_dict()
    return None


def create_user(user_id, user_data):
    """Create a new user document with the given id."""
    db.collection(USERS_COLLECTION).document(user_id).set(user_data)


def update_user(user_id, fields):
    """Merge-update specific fields on an existing user document."""
    db.collection(USERS_COLLECTION).document(user_id).set(fields, merge=True)


# ══════════════════════════════════════════════════════════════════════════
# RESULTS (interview sessions, quiz attempts, skill-gap analyses)
# ══════════════════════════════════════════════════════════════════════════

def add_result(user_id, session):
    """Add a result document. Uses the session's own id as the document id."""
    session = dict(session)
    session["userId"] = user_id
    db.collection(RESULTS_COLLECTION).document(session["id"]).set(session)


def get_results_for_user(user_id):
    """Return all result sessions for a user, newest first."""
    query = (
        db.collection(RESULTS_COLLECTION)
        .where("userId", "==", user_id)
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [doc.to_dict() for doc in query]


# ══════════════════════════════════════════════════════════════════════════
# CV FILE STORAGE — not used (Storage plan removed)
# ══════════════════════════════════════════════════════════════════════════

def upload_cv_pdf(user_id, local_file_path, original_filename):
    """
    Stub — Firebase Storage has been removed to avoid paid plan.
    CV text is extracted locally and saved to Firestore instead.
    Always returns None so the caller skips the URL gracefully.
    """
    return None
