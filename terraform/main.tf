terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ------------------------------------------------------------------------------
# 1. Google Cloud Storage Bucket for Static Website Hosting
# ------------------------------------------------------------------------------
resource "google_storage_bucket" "website_bucket" {
  name          = var.website_bucket_name
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Public read access for static website assets
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.website_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ------------------------------------------------------------------------------
# 2. Google Cloud Firestore Native Database
# ------------------------------------------------------------------------------
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  concurrency_mode                = "OPTIMISTIC"
  app_engine_integration_mode     = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"
  delete_protection_state         = "DELETE_PROTECTION_DISABLED"
  deletion_policy                 = "DELETE"
}

# ------------------------------------------------------------------------------
# 3. Dedicated Least-Privilege Service Account for Cloud Function
# ------------------------------------------------------------------------------
resource "google_service_account" "function_sa" {
  account_id   = "cloudport-fn-sa"
  display_name = "CloudPort Cloud Function Runtime Service Account"
  description  = "Dedicated service account used by CloudPort HTTP Cloud Function with least-privilege Datastore User role."
}

# Grant Datastore User role (allows read/write to Firestore Native)
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.function_sa.email}"
}

# ------------------------------------------------------------------------------
# 4. Source Code Packaging & GCS Source Archive Bucket
# ------------------------------------------------------------------------------
resource "google_storage_bucket" "function_source_bucket" {
  name                        = "${var.project_id}-cloudport-source-archive"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

data "archive_file" "function_zip" {
  type        = "zip"
  output_path = "${path.module}/function-source.zip"
  source_dir  = "${path.module}/../backend"
  excludes    = ["node_modules", "tests", ".pytest_cache", "__pycache__"]
}

resource "google_storage_bucket_object" "function_zip_object" {
  name   = "source-${data.archive_file.function_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_source_bucket.name
  source = data.archive_file.function_zip.output_path
}

# ------------------------------------------------------------------------------
# 5. Google Cloud Function (Gen 2) HTTP Trigger
# ------------------------------------------------------------------------------
resource "google_cloudfunctions2_function" "cloudport_function" {
  name        = var.function_name
  location    = var.region
  description = "CloudPort HTTP endpoint for attendee registration with Firestore persistence"

  build_config {
    runtime     = "nodejs20"
    entry_point = "cloudportRegistration"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source_bucket.name
        object = google_storage_bucket_object.function_zip_object.name
      }
    }
  }

  service_config {
    max_instance_count             = 10
    min_instance_count             = 0
    available_memory               = "256M"
    timeout_seconds                = 60
    service_account_email          = google_service_account.function_sa.email
    all_traffic_on_latest_revision = true

    environment_variables = {
      ALLOWED_ORIGIN        = var.allowed_origin
      FIRESTORE_DATABASE_ID = "(default)"
    }
  }

  depends_on = [
    google_project_iam_member.firestore_user,
    google_firestore_database.database
  ]
}

# Allow unauthenticated invocations for public event registration
resource "google_cloud_run_service_iam_member" "public_invoker" {
  location = google_cloudfunctions2_function.cloudport_function.location
  service  = google_cloudfunctions2_function.cloudport_function.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
