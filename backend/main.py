"""
CloudPort — Google Cloud Function Backend (Python)
HTTP Triggered Serverless Function with Cloud Firestore Native Integration

Target: cloudport_registration
Runtime: Python 3.10 / 3.11 / 3.12
Supports: Google Cloud Functions, Local Development, and Vercel Serverless

Organized by Google Developer Groups On Campus BPPIMT
"""

import os
import re
import json
import logging
import uuid
import time
from typing import Dict, Any, Tuple, List
try:
    import functions_framework
except ImportError:
    class _FFStub:
        @staticmethod
        def http(f):
            return f
    functions_framework = _FFStub()

try:
    from google.cloud import firestore
except ImportError:
    firestore = None

# Configure standard logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudport-backend")

# In-memory storage for offline / local / Vercel fallback without GCP credentials
_local_store: Dict[str, Dict[str, Any]] = {}

class LocalCollectionStub:
    def __init__(self, name: str):
        self.name = name

    def where(self, field: str, op: str, val: Any):
        class LocalQueryStub:
            def __init__(self, f: str, o: str, v: Any):
                self.f = f
                self.o = o
                self.v = v

            def limit(self, num: int):
                class LocalLimitStub:
                    def __init__(self, parent_query, n: int):
                        self.pq = parent_query
                        self.n = n

                    def stream(self):
                        matches = []
                        for d_id, doc in _local_store.items():
                            if doc.get(self.pq.f) == self.pq.v:
                                class DocSnapshot:
                                    def __init__(self, doc_id, doc_data):
                                        self.id = doc_id
                                        self._data = doc_data
                                    def to_dict(self):
                                        return self._data
                                matches.append(DocSnapshot(d_id, doc))
                                if len(matches) >= self.n:
                                    break
                        return iter(matches)
                return LocalLimitStub(self, num)
        return LocalQueryStub(field, op, val)

    def add(self, data: Dict[str, Any]):
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        _local_store[doc_id] = {**data, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")}
        class DocRefStub:
            def __init__(self, d_id: str):
                self.id = d_id
        return time.time(), DocRefStub(doc_id)

class LocalFirestoreStub:
    def collection(self, name: str):
        return LocalCollectionStub(name)

# Lazy-loaded Firestore client using Application Default Credentials (ADC)
_firestore_client = None

def get_firestore_client():
    """Retrieve or initialize the Firestore Client with fallback stub."""
    global _firestore_client
    if _firestore_client is None:
        project_id = os.environ.get("GCP_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
        database_id = os.environ.get("FIRESTORE_DATABASE_ID", "(default)")
        is_cloud_env = os.environ.get("K_SERVICE") or os.environ.get("GAE_SERVICE")

        if not is_cloud_env and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and not project_id:
            _firestore_client = LocalFirestoreStub()
            return _firestore_client

        try:
            if firestore:
                _firestore_client = firestore.Client(project=project_id, database=database_id)
            else:
                _firestore_client = LocalFirestoreStub()
        except Exception:
            _firestore_client = LocalFirestoreStub()
    return _firestore_client

def get_cors_headers() -> Dict[str, str]:
    """Build CORS response headers."""
    allowed_origin = os.environ.get("ALLOWED_ORIGIN", "*")
    return {
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
        "Access-Control-Max-Age": "3600"
    }

def validate_registration_payload(data: Any) -> List[str]:
    """Validate incoming registration payload."""
    errors = []

    if not isinstance(data, dict):
        return ["Request body must be a valid JSON object."]

    name = data.get("name")
    email = data.get("email")
    department = data.get("department")
    interest = data.get("interest")

    # Name validation
    if not isinstance(name, str) or len(name.strip()) < 2:
        errors.append("Full Name is required and must be at least 2 characters.")
    elif len(name.strip()) > 100:
        errors.append("Full Name cannot exceed 100 characters.")

    # Email validation (RFC 5322 regex)
    email_regex = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    if not isinstance(email, str) or not email.strip():
        errors.append("Email address is required.")
    elif not email_regex.match(email.strip()):
        errors.append("A valid email address is required (e.g., student@domain.com).")
    elif len(email.strip()) > 120:
        errors.append("Email address cannot exceed 120 characters.")

    # Department validation
    if not isinstance(department, str) or not department.strip():
        errors.append("Department is required.")
    elif len(department.strip()) > 80:
        errors.append("Department name cannot exceed 80 characters.")

    # Area of interest validation
    if not isinstance(interest, str) or not interest.strip():
        errors.append("Area of Interest is required.")
    elif len(interest.strip()) > 80:
        errors.append("Area of Interest cannot exceed 80 characters.")

    return errors

@functions_framework.http
def cloudport_registration(request):
    """
    HTTP Cloud Function entry point for CloudPort registration.
    Handles OPTIONS preflight, validates JSON payload, and persists to Firestore.
    """
    cors_headers = get_cors_headers()

    # 1. Handle OPTIONS Preflight
    if request.method == "OPTIONS":
        return ("", 204, cors_headers)

    # Health check for GET
    if request.method == "GET":
        response_body = json.dumps({
            "success": True,
            "message": "CloudPort Registration API is running. Submit POST requests to register."
        })
        headers = {**cors_headers, "Content-Type": "application/json"}
        return (response_body, 200, headers)

    # 2. Reject Non-POST Methods (HTTP 405)
    if request.method != "POST":
        response_body = json.dumps({
            "success": False,
            "error": "Method Not Allowed",
            "message": f"HTTP method {request.method} is not supported. Use POST."
        })
        headers = {**cors_headers, "Content-Type": "application/json"}
        return (response_body, 405, headers)

    # 3. Validate Content-Type (HTTP 415)
    content_type = request.headers.get("content-type", "")
    if "application/json" not in content_type:
        response_body = json.dumps({
            "success": False,
            "error": "Unsupported Media Type",
            "message": "Content-Type must be application/json."
        })
        headers = {**cors_headers, "Content-Type": "application/json"}
        return (response_body, 415, headers)

    # Parse JSON body
    try:
        request_json = request.get_json(silent=True)
    except Exception:
        request_json = None

    # 4. Validate Request Payload (HTTP 400)
    validation_errors = validate_registration_payload(request_json)
    if validation_errors:
        response_body = json.dumps({
            "success": False,
            "error": "Validation Failed",
            "details": validation_errors,
            "message": " ".join(validation_errors)
        })
        headers = {**cors_headers, "Content-Type": "application/json"}
        return (response_body, 400, headers)

    clean_name = request_json["name"].strip()
    clean_email = request_json["email"].strip().lower()
    clean_dept = request_json["department"].strip()
    clean_interest = request_json["interest"].strip()

    try:
        db = get_firestore_client()
        registrations_ref = db.collection("registrations")

        # 5. Duplicate Check
        existing_docs = list(registrations_ref.where("email", "==", clean_email).limit(1).stream())
        if existing_docs:
            response_body = json.dumps({
                "success": False,
                "error": "Duplicate Registration",
                "message": f"The email address '{clean_email}' has already been registered for CloudPort."
            })
            headers = {**cors_headers, "Content-Type": "application/json"}
            return (response_body, 409, headers)

        # 6. Persist Document to Firestore Native
        doc_data = {
            "name": clean_name,
            "email": clean_email,
            "department": clean_dept,
            "interest": clean_interest,
            "createdAt": firestore.SERVER_TIMESTAMP if firestore and hasattr(firestore, "SERVER_TIMESTAMP") else time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        update_time, doc_ref = registrations_ref.add(doc_data)

        # 7. Structured JSON Success Response (HTTP 201)
        response_body = json.dumps({
            "success": True,
            "message": "Registration successfully stored in Google Cloud Firestore.",
            "data": {
                "id": doc_ref.id,
                "name": clean_name,
                "email": clean_email,
                "department": clean_dept,
                "interest": clean_interest,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
            }
        })
        headers = {**cors_headers, "Content-Type": "application/json"}
        return (response_body, 201, headers)

    except Exception as exc:
        # 8. Safe error handling (no leaked internal stack traces)
        logger.error(f"Error persisting registration to Firestore: {str(exc)}", exc_info=True)
        response_body = json.dumps({
            "success": False,
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your registration. Please try again later."
        })
        headers = {**cors_headers, "Content-Type": "application/json"}
        return (response_body, 500, headers)


# ------------------------------------------------------------------------------
# Vercel Serverless WSGI Entry Point (exports 'app', 'application', and 'handler')
# ------------------------------------------------------------------------------
try:
    from flask import Flask, request as flask_req

    app = Flask(__name__)

    @app.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    @app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    def vercel_entrypoint(path=""):
        return cloudport_registration(flask_req)

    # Vercel looks for a top-level variable named 'app', 'application', or 'handler'
    application = app
    handler = app

except ImportError:
    # If Flask is not installed directly, assign handler as function
    app = cloudport_registration
    application = cloudport_registration
    handler = cloudport_registration
