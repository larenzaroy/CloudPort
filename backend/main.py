"""
CloudPort — Google Cloud Function Backend (Python)
HTTP Triggered Serverless Function with Cloud Firestore Native Integration

Target: cloudport_registration
Runtime: Python 3.10 / 3.11 / 3.12

Organized by Google Developer Groups On Campus BPPIMT
"""

import os
import re
import json
import logging
from typing import Dict, Any, Tuple, List
import functions_framework
from google.cloud import firestore

# Configure standard logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudport-backend")

# Lazy-loaded Firestore client using Application Default Credentials (ADC)
_firestore_client = None

def get_firestore_client() -> firestore.Client:
    """Retrieve or initialize the Firestore Client."""
    global _firestore_client
    if _firestore_client is None:
        project_id = os.environ.get("GCP_PROJECT_ID") or None
        database_id = os.environ.get("FIRESTORE_DATABASE_ID", "(default)")
        _firestore_client = firestore.Client(project=project_id, database=database_id)
    return _firestore_client

def get_cors_headers() -> Dict[str, str]:
    """Build CORS response headers."""
    allowed_origin = os.environ.get("ALLOWED_ORIGIN", "*")
    return {
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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
            "createdAt": firestore.SERVER_TIMESTAMP
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
                "interest": clean_interest
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
