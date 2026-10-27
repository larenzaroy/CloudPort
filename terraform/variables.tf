variable "project_id" {
  description = "The Google Cloud Platform Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for deploying resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "prod"
}

variable "website_bucket_name" {
  description = "Globally unique name for the Google Cloud Storage static website bucket"
  type        = string
  default     = "cloudport-website-gdg-bppimt"
}

variable "function_name" {
  description = "Name of the HTTP-triggered Google Cloud Function"
  type        = string
  default     = "cloudport-registration"
}

variable "allowed_origin" {
  description = "Allowed CORS origin for the Cloud Function (e.g. * or your website domain)"
  type        = string
  default     = "*"
}
