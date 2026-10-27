/**
 * CloudPort — Frontend Configuration
 * Google Developer Groups On Campus BPPIMT
 * 
 * Update API_URL with your deployed Google Cloud Function URL.
 * Example Gen 2 URL: https://cloudport-registration-xyz-uc.a.run.app
 * Example Gen 1 URL: https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/cloudportRegistration
 */

const isLocalHost = 
  !window.location.hostname || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.protocol === 'file:';

window.CLOUDPORT_CONFIG = {
  // In local development, submit to localhost:8080
  // In production, update this with your deployed Google Cloud Function HTTPS endpoint
  API_URL: isLocalHost
    ? (window.location.origin && window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8080')
    : 'https://cloud-port-hsla-eta.vercel.app',
  
  // Timeout in milliseconds for registration requests
  REQUEST_TIMEOUT_MS: 15000,

  // Event information
  EVENT_NAME: 'CloudPort 2026',
  ORGANIZER: 'Google Developer Groups On Campus BPPIMT'
};
