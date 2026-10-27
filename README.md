# CloudPort — Serverless Web Application & Google Cloud Function Integration

[![Google Cloud Platform](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com)
[![Cloud Functions](https://img.shields.io/badge/Cloud_Functions_Gen2-8B5CF6?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/functions)
[![Cloud Firestore](https://img.shields.io/badge/Firestore_Native-F59E0B?style=for-the-badge&logo=firebase&logoColor=white)](https://cloud.google.com/firestore)
[![GDG On Campus BPPIMT](https://img.shields.io/badge/GDG_On_Campus-BPPIMT-0F9D58?style=for-the-badge&logo=google&logoColor=white)](https://gdg.community.dev)

A complete, production-grade, secure, and fully responsive serverless web application engineered for the **Google Developer Groups (GDG) On Campus BPPIMT Cloud Team Selection Task**.

---

## 📑 Table of Contents

- [1. Executive Summary & Objectives](#1-executive-summary--objectives)
- [2. Live Endpoints & Submission Details](#2-live-endpoints--submission-details)
- [3. Technology Stack](#3-technology-stack)
- [4. System Architecture](#4-system-architecture)
- [5. Repository Structure](#5-repository-structure)
- [6. Security & Least Privilege IAM](#6-security--least-privilege-iam)
- [7. Local Setup & Testing Guide](#7-local-setup--testing-guide)
- [8. Google Cloud Deployment Guide](#8-google-cloud-deployment-guide)
  - [Step 1: GCP Project & API Initialization](#step-1-gcp-project--api-initialization)
  - [Step 2: Google Cloud Firestore (Native Mode)](#step-2-google-cloud-firestore-native-mode)
  - [Step 3: Service Account & IAM Permissions](#step-3-service-account--iam-permissions)
  - [Step 4: Deploying Serverless Cloud Function (Node.js & Python)](#step-4-deploying-serverless-cloud-function-nodejs--python)
  - [Step 5: Deploying Frontend to Google Cloud Storage (or Cloud Run)](#step-5-deploying-frontend-to-google-cloud-storage-or-cloud-run)
  - [Step 6: Frontend-Backend Integration Verification](#step-6-frontend-backend-integration-verification)
- [9. Infrastructure as Code (Terraform)](#9-infrastructure-as-code-terraform)
- [10. Cloud Console Verification & Screenshots Checklist](#10-cloud-console-verification--screenshots-checklist)
- [11. Troubleshooting Guide](#11-troubleshooting-guide)
- [12. Bonus Features & Production Enhancements](#12-bonus-features--production-enhancements)

---

## 1. Executive Summary & Objectives

**CloudPort** serves as an event registration and attendee onboarding portal for the GDG On Campus BPPIMT Cloud Track Workshop. Built strictly without AI/ML APIs, the project demonstrates mastery over modern serverless cloud engineering:

1. **Stateless Compute**: Utilizing HTTP-triggered **Google Cloud Functions (Gen 2)** with auto-scaling to zero.
2. **Managed NoSQL Storage**: Utilizing **Google Cloud Firestore in Native mode** for transactional document persistence with server-generated timestamps.
3. **High-Performance Static Hosting**: Leveraging **Google Cloud Storage (GCS)** buckets with public-read website configuration and low latency asset delivery.
4. **Least-Privilege Security**: Zero hardcoded credentials; fully authenticated via **Application Default Credentials (ADC)** and fine-grained Cloud IAM roles (`roles/datastore.user`).
5. **Robust CORS & Preflight**: Full support for HTTP `OPTIONS` preflight, restricted origins, and RFC 5322 regex validation.

---

## 2. Live Endpoints & Submission Details

> **Note**: Replace the placeholders below with the exact URLs once deployed to your GCP environment.

| Component | Status | Production Endpoint / URL |
| :--- | :--- | :--- |
| **Frontend Static Website** | Deployed | `https://storage.googleapis.com/YOUR_BUCKET_NAME/index.html` |
| **Cloud Function (Gen 2 HTTP)** | Deployed | `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/cloudportRegistration` |
| **Cloud Firestore Database** | Native Mode | `(default)` in region `us-central1` |
| **Source Repository** | GitHub | `https://github.com/larenzaroy/CloudPort` |

---

## 3. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Zero frameworks; responsive design system; mobile drawer; real-time validation; `fetch()` API with `AbortController` timeout. |
| **Frontend Hosting** | Google Cloud Storage (Option A) / Cloud Run (Option B) | High-availability static web hosting with uniform bucket-level access and public-read IAM permissions. |
| **Backend Compute** | Google Cloud Functions (Gen 2) | Node.js 20/22 (`@google-cloud/functions-framework`) & Python 3.11 (`functions-framework`). |
| **Database** | Google Cloud Firestore (Native Mode) | Scalable NoSQL document store with server-side timestamps (`FieldValue.serverTimestamp()`). |
| **Security & IAM** | Google Cloud IAM & ADC | Dedicated service account (`cloudport-fn-sa`), `roles/datastore.user` role; zero hardcoded secrets. |
| **IaC (Bonus)** | HashiCorp Terraform | Declarative provisioning for GCS bucket, Firestore DB, IAM bindings, and Cloud Function. |

---

## 4. System Architecture

### Architectural Flowchart

```
[ Visitor / Client Browser ]
  (Mobile, Tablet, Desktop)
            │
            ├─────────────────────────┐
            │ 1. HTTPS GET            │ 2. HTTPS POST (JSON)
            ▼                         ▼
┌────────────────────────┐  ┌──────────────────────────────────────────────────┐
│  Google Cloud Storage  │  │         Google Cloud Function (Gen 2)            │
│ (Static Website Host)  │  │  - CORS Preflight (OPTIONS -> 204 No Content)    │
│  - index.html          │  │  - RFC 5322 Email & Payload Validation           │
│  - style.css           │  │  - Duplicate Registration Detection             │
│  - script.js           │  │  - Attached Service Account (ADC)                │
└────────────────────────┘  └─────────────────────────┬────────────────────────┘
                                                      │
                                                      │ 3. ADC Write (roles/datastore.user)
                                                      ▼
                                        ┌───────────────────────────────┐
                                        │  Google Cloud Firestore       │
                                        │  - Mode: Native               │
                                        │  - Collection: "registrations"│
                                        │  - Fields: name, email,       │
                                        │    department, interest,      │
                                        │    createdAt (serverTimestamp)│
                                        └──────────────┬────────────────┘
                                                       │
                                                       │ 4. Structured JSON Response (201/400/409/500)
                                                       ▼
                                            [ Client UI Notification ]
                                         (Success Card / Error Toast)
```

### Visual Architecture Diagram
The repository includes vector and high-resolution architecture diagrams in the `architecture/` directory:
- [Vector SVG Diagram](architecture/architecture-diagram.svg)
- [High-Resolution PNG Diagram](architecture/architecture-diagram.png)

---

## 5. Repository Structure

```
cloudport/
├── frontend/
│   ├── index.html               # Semantic, accessible HTML5 landing page & registration form
│   ├── style.css                # Google Cloud themed responsive stylesheet with animations
│   ├── script.js                # Vanilla JS form validation, fetch API handling, and UI states
│   └── config.js                # Environment-aware backend endpoint configuration
├── backend/
│   ├── index.js                 # Node.js Cloud Function implementation (Gen 2 / Gen 1)
│   ├── package.json             # Node.js dependencies (@google-cloud/firestore)
│   ├── main.py                  # Python Cloud Function implementation (Python 3.11 alternative)
│   ├── requirements.txt         # Python dependencies (functions-framework, google-cloud-firestore)
│   └── tests/
│       └── api.test.js          # Automated unit & integration tests (Node.js test runner)
├── architecture/
│   ├── architecture-diagram.svg # Scalable Vector Graphics architectural blueprint
│   └── architecture-diagram.png # High-resolution architecture visual
├── terraform/                   # Bonus: Infrastructure as Code
│   ├── main.tf                  # GCS, Firestore, Service Account, and Cloud Function definitions
│   ├── variables.tf             # Configurable deployment parameters
│   ├── outputs.tf               # Generated URLs and database references
│   └── terraform.tfvars.example # Sample variable values for terraform plan/apply
├── .gitignore                   # Strict protection against committing keys, node_modules, or envs
├── .env.example                 # Non-sensitive configuration sample
└── README.md                    # Comprehensive documentation and deployment guide
```

---

## 6. Security & Least Privilege IAM

Security is a primary pillar of this project:

1. **No Client-Side Secrets**:
   - The frontend JavaScript does NOT contain Firebase API keys, service account JSON files, or database tokens. It solely communicates with the public HTTPS trigger of the Cloud Function.
2. **Dedicated Runtime Service Account**:
   - The Cloud Function executes under a purpose-built Google Cloud Service Account:
     `cloudport-fn-sa@<PROJECT_ID>.iam.gserviceaccount.com`.
   - The service account is granted ONLY `roles/datastore.user` on the project. It has **no** permissions to delete databases, modify IAM policies, or access other GCP services.
3. **Application Default Credentials (ADC)**:
   - When running on Google Cloud Functions, the official `@google-cloud/firestore` SDK automatically resolves credentials from the metadata server. No service account key files are downloaded or saved to disk.
4. **Strict Input Validation & Sanitization**:
   - Validates character lengths (e.g., name 2–100 characters, email 5–120 characters).
   - Validates email strings using RFC 5322 compliant regular expressions.
   - Trims whitespace and normalizes email addresses to lowercase to prevent casing duplicates.
   - Enforces `Content-Type: application/json`.
5. **CORS Hardening**:
   - Handles HTTP `OPTIONS` preflight requests immediately with `HTTP 204 No Content`.
   - Configurable `ALLOWED_ORIGIN` environment variable allows locking the backend to the exact static website domain in production.
6. **Error Redaction**:
   - Internal database error messages and stack traces are captured in Cloud Logging and never returned to the browser. The frontend receives clean, structured JSON: `{ "success": false, "error": "Internal Server Error" }`.

---

## 7. Local Setup & Testing Guide

### Prerequisites
- Node.js (v18, v20, or v22+)
- (Optional) Python (v3.10+) if testing the Python backend

### Running Automated Backend Tests
The repository includes an automated test suite verifying all HTTP methods, CORS headers, email validation, and error states using the built-in Node test runner:

```bash
cd backend
npm test
```

Expected output:
```
✔ CloudPort Backend - Payload Validation Tests
  ✔ Accepts complete valid registration payload
  ✔ Rejects null or non-object payloads
  ✔ Rejects missing or invalid full name
  ✔ Rejects invalid email format
  ✔ Rejects missing department or area of interest
✔ CloudPort Backend - Cloud Function HTTP Handler Tests
  ✔ Handles OPTIONS preflight request with 204 status and CORS headers
  ✔ Rejects non-POST methods with HTTP 405 Method Not Allowed
  ✔ Rejects non-JSON content-type with HTTP 415 Unsupported Media Type
  ✔ Rejects invalid input payload with HTTP 400 Bad Request
  ✔ Successfully processes valid registration and returns HTTP 201 Created
  ✔ Rejects duplicate email registrations with HTTP 409 Conflict
  ✔ Safely handles unexpected Firestore failures with HTTP 500 without leaking stack traces
ℹ tests 12 | pass 12 | fail 0
```

### Running Backend Locally via Functions Framework

#### Option 1 — Node.js Backend:
```bash
cd backend
npm install
npm start
```
The endpoint will be available at `http://localhost:8080`.

#### Option 2 — Python Backend:
```bash
cd backend
pip install -r requirements.txt
functions-framework --target=cloudport_registration --port=8080 --debug
```

### Running Frontend Locally
Serve the `frontend/` directory using any local web server:

```bash
# Using Node.js (built-in)
npx serve frontend -p 3000

# Or using Python (built-in)
python -m http.server 3000 --directory frontend
```
Open `http://localhost:3000` in your browser. `frontend/config.js` automatically routes requests to `http://localhost:8080` when hosted on `localhost`.

---

## 8. Google Cloud Deployment Guide

Follow these exact, copy-pasteable commands to deploy CloudPort to Google Cloud Platform.

### Step 1: GCP Project & API Initialization

Set your Google Cloud Project and region:

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"

gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com
```

### Step 2: Google Cloud Firestore (Native Mode)

Create the Firestore database in **Native mode** (Standard NoSQL document database):

```bash
gcloud firestore databases create \
  --location=$REGION \
  --type=firestore-native
```

> **Verification**: Run `gcloud firestore databases describe` to verify that the type is `FIRESTORE_NATIVE` and status is `AVAILABLE`.

### Step 3: Service Account & IAM Permissions

Create a dedicated runtime service account with the principle of least privilege:

```bash
# 1. Create the service account
gcloud iam service-accounts create cloudport-fn-sa \
  --description="Runtime service account for CloudPort registration function" \
  --display-name="CloudPort Function SA"

# 2. Grant roles/datastore.user permission
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:cloudport-fn-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Step 4: Deploying Serverless Cloud Function (Node.js & Python)

Deploy from the `backend/` directory as an HTTP-triggered Cloud Function (Gen 2):

#### Deploying Node.js Runtime (Recommended):
```bash
cd backend

gcloud functions deploy cloudportRegistration \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=. \
  --entry-point=cloudportRegistration \
  --trigger-http \
  --allow-unauthenticated \
  --service-account="cloudport-fn-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-env-vars=ALLOWED_ORIGIN="*",FIRESTORE_DATABASE_ID="(default)" \
  --memory=256MB \
  --timeout=60s
```

#### Deploying Python Runtime (Alternative):
```bash
cd backend

gcloud functions deploy cloudport-registration \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=cloudport_registration \
  --trigger-http \
  --allow-unauthenticated \
  --service-account="cloudport-fn-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-env-vars=ALLOWED_ORIGIN="*",FIRESTORE_DATABASE_ID="(default)" \
  --memory=256MB \
  --timeout=60s
```

> **Retrieve Function Endpoint**:
> ```bash
> gcloud functions describe cloudportRegistration --region=$REGION --format="value(serviceConfig.uri)"
> ```
> Copy the output URI (e.g., `https://cloudportregistration-xyz-uc.a.run.app`).

### Step 5: Deploying Frontend to Google Cloud Storage (or Cloud Run)

#### Option A: Google Cloud Storage (Static Website Hosting)

1. **Update `frontend/config.js`** with your deployed Cloud Function endpoint:
   ```javascript
   window.CLOUDPORT_CONFIG = {
     API_URL: 'https://cloudportregistration-xyz-uc.a.run.app',
     REQUEST_TIMEOUT_MS: 15000
   };
   ```

2. **Create a unique storage bucket and configure web hosting**:
   ```bash
   export BUCKET_NAME="cloudport-web-${PROJECT_ID}"

   # Create the bucket
   gcloud storage buckets create gs://${BUCKET_NAME} \
     --location=$REGION \
     --uniform-bucket-level-access

   # Configure index and error pages
   gcloud storage buckets update gs://${BUCKET_NAME} \
     --web-main-page-suffix=index.html \
     --web-error-page=index.html

   # Grant public-read access to all website visitors
   gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
     --member=allUsers \
     --role=roles/storage.objectViewer

   # Upload frontend assets
   cd frontend
   gcloud storage cp index.html style.css script.js config.js gs://${BUCKET_NAME}/
   ```

3. **Access Your Live Website**:
   ```
   https://storage.googleapis.com/cloudport-web-YOUR_PROJECT_ID/index.html
   ```

#### Option B: Google Cloud Run Alternative (Containerized Static Web)
If preferred, you can deploy using Cloud Run:
```bash
gcloud run deploy cloudport-frontend \
  --source=./frontend \
  --region=$REGION \
  --allow-unauthenticated
```

### Step 6: Frontend-Backend Integration Verification

Test the deployed application end-to-end:
1. Open the live frontend URL in your browser.
2. Complete the registration form:
   - **Full Name**: `Test Candidate`
   - **Email Address**: `test.candidate@bppimt.edu.in`
   - **Department**: `Computer Science & Engineering`
   - **Area of Interest**: `Serverless & Cloud Functions`
3. Click **Complete Registration**.
4. Verify the animated spinner appears and the button is disabled.
5. Confirm the green success banner appears displaying the generated **Firestore Document ID** and timestamp.
6. Check Firestore in the Google Cloud Console to verify the document exists under the `registrations` collection.

---

## 9. Infrastructure as Code (Terraform)

For reproducible, automated provisioning, the `terraform/` folder contains a complete Terraform module.

```bash
cd terraform

# 1. Copy example variables
cp terraform.tfvars.example terraform.tfvars

# 2. Edit terraform.tfvars with your GCP project ID
# project_id = "your-project-id"

# 3. Initialize Terraform plugins
terraform init

# 4. Preview resource provisioning
terraform plan

# 5. Apply and provision all GCP resources
terraform apply -auto-approve
```

Terraform automatically provisions:
- The GCS static website bucket with public-read permissions.
- The Firestore database in Native mode.
- The dedicated runtime service account with `roles/datastore.user`.
- The Cloud Function (Gen 2) packaged from source with public HTTP invoker permissions.

---

## 10. Cloud Console Verification & Screenshots Checklist

When presenting or submitting the task, capture the following Google Cloud Console screenshots:

- [ ] **Firestore Database**: Navigation to **Firestore Studio** showing the `registrations` collection with document fields: `name`, `email`, `department`, `interest`, and `createdAt`.
- [ ] **Cloud Functions Dashboard**: Navigation to **Cloud Functions** showing `cloudportRegistration` active with green checkmark (Gen 2, region `us-central1`).
- [ ] **Function Metrics**: The **Metrics** tab showing invocations, execution time (latency), and 2xx status codes.
- [ ] **Cloud Storage Bucket**: Navigation to **Cloud Storage** showing `gs://cloudport-web-...` with `index.html`, `style.css`, `script.js`, and `config.js` public access set to "Public to internet".
- [ ] **IAM Policy**: Navigation to **IAM & Admin** showing `cloudport-fn-sa` assigned the **Datastore User** role.
- [ ] **Live Web App**: Browser screenshot of CloudPort loaded on both desktop and mobile viewports with a successful registration toast.

---

## 11. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **CORS Error in Browser** | Mismatched origins or missing preflight handling | Verify `ALLOWED_ORIGIN` env var is set to `*` or matches your GCS URL. Ensure the function returns `204 No Content` for `OPTIONS`. |
| **HTTP 403 Forbidden on Function Call** | Unauthenticated invocations not enabled | Add `roles/run.invoker` to `allUsers`: `gcloud run services add-iam-policy-binding cloudportregistration --region=us-central1 --member=allUsers --role=roles/run.invoker` |
| **HTTP 500: Missing or insufficient permissions** | Service account lacks Firestore permissions | Ensure `roles/datastore.user` is bound to `cloudport-fn-sa@<PROJECT_ID>.iam.gserviceaccount.com`. |
| **HTTP 400 Bad Request** | Validation failed (short name, invalid email) | Verify input conforms to RFC 5322 regex and minimum lengths. The backend response will detail the exact field. |
| **HTTP 409 Conflict** | Email already registered | Attendee is already in Firestore. Use a new email address or clear test documents in Firestore Studio. |
| **GCS Bucket 403 Access Denied** | Bucket missing public-read permissions | Run `gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME --member=allUsers --role=roles/storage.objectViewer`. |

---

## 12. Bonus Features & Production Enhancements

1. **Custom Domain & HTTPS via Cloud CDN**:
   - Create a Google Cloud Global External HTTP(S) Load Balancer.
   - Point backend to the GCS bucket.
   - Attach a free Google-managed SSL certificate (`example.gdgbppimt.com`).
2. **Cloud Logging & Error Alerting**:
   - Set up an alert policy in **Google Cloud Monitoring** triggering email or Slack notifications when HTTP 5xx error rates exceed 1% over a 5-minute rolling window.
3. **Automated Event Confirmation via Pub/Sub**:
   - The Cloud Function can optionally publish registration events to a Google Cloud Pub/Sub topic (`projects/<PROJECT_ID>/topics/new-registration`).
   - A secondary downstream Cloud Function can trigger transactional confirmation emails via SendGrid or Google Workspace SMTP.

---

## 👨‍💻 Community & Authorship

Developed with pride for the **Google Developer Groups (GDG) On Campus B.P. Poddar Institute of Management and Technology (BPPIMT)** Cloud Team Selection Task.

*“Fostering cloud innovation, open source, and serverless engineering.”*
