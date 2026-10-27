output "website_bucket_name" {
  description = "The Google Cloud Storage bucket hosting the static website"
  value       = google_storage_bucket.website_bucket.name
}

output "website_url" {
  description = "Direct HTTP/HTTPS access URL for the static website on GCS"
  value       = "https://storage.googleapis.com/${google_storage_bucket.website_bucket.name}/index.html"
}

output "cloud_function_uri" {
  description = "HTTPS trigger URL for the deployed Google Cloud Function (Gen 2)"
  value       = google_cloudfunctions2_function.cloudport_function.service_config[0].uri
}

output "service_account_email" {
  description = "Email of the dedicated Cloud Function runtime service account"
  value       = google_service_account.function_sa.email
}

output "firestore_database_name" {
  description = "Name of the provisioned Firestore Native database"
  value       = google_firestore_database.database.name
}
