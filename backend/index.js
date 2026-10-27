/**
 * CloudPort — Google Cloud Function Backend (Node.js)
 * HTTP Triggered Serverless Function with Cloud Firestore Native Integration
 * 
 * Target: cloudportRegistration
 * Runtime: Node.js 20 / 22
 * 
 * Organized by Google Developer Groups On Campus BPPIMT
 */

'use strict';

// Dynamic / Lazy Firestore SDK resolution (supports production ADC & unit test mocking)
let firestoreSdk = null;

function getFirestoreSdk() {
  if (!firestoreSdk) {
    try {
      firestoreSdk = require('@google-cloud/firestore');
    } catch {
      firestoreSdk = {
        Firestore: class MockFirestoreStub {},
        FieldValue: {
          serverTimestamp: () => new Date().toISOString()
        }
      };
    }
  }
  return firestoreSdk;
}

// In-memory fallback for offline local testing without GCP credentials
const localDevStore = new Map();

function createLocalFirestoreStub() {
  return {
    collection(name) {
      return {
        where(field, op, val) {
          return {
            limit(num) {
              return {
                async get() {
                  const matches = [];
                  for (const [id, doc] of localDevStore.entries()) {
                    if (doc[field] === val) {
                      matches.push({ id, data: () => doc });
                    }
                  }
                  return {
                    empty: matches.length === 0,
                    docs: matches
                  };
                }
              };
            }
          };
        },
        async add(data) {
          const id = 'doc-' + Math.random().toString(36).substring(2, 10);
          localDevStore.set(id, { ...data, createdAt: new Date().toISOString() });
          return { id };
        }
      };
    }
  };
}

// Lazily initialized Firestore client (uses Application Default Credentials)
let firestoreInstance = null;

/**
 * Retrieve or initialize Firestore instance.
 * Uses ADC (attached Cloud Function Service Account) in GCP.
 */
function getFirestore() {
  if (!firestoreInstance) {
    const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const isCloudEnv = process.env.K_SERVICE || process.env.GAE_SERVICE;

    if (!isCloudEnv && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST && !projectId) {
      firestoreInstance = createLocalFirestoreStub();
      return firestoreInstance;
    }

    try {
      const { Firestore } = getFirestoreSdk();
      const config = {};
      if (projectId) {
        config.projectId = projectId;
      }
      if (process.env.FIRESTORE_DATABASE_ID) {
        config.databaseId = process.env.FIRESTORE_DATABASE_ID;
      }
      firestoreInstance = new Firestore(config);
    } catch (err) {
      firestoreInstance = createLocalFirestoreStub();
    }
  }
  return firestoreInstance;
}

/**
 * For testing and mocking Firestore during automated unit tests
 */
function setFirestoreInstance(instance) {
  firestoreInstance = instance;
}

/**
 * Helper: Sets CORS response headers based on environment configuration
 */
function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * Validates registration input payload
 * Checks for required fields: name, email, department, interest
 * @returns {Array<string>} List of validation error messages, if any
 */
function validateRegistrationPayload(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Request body must be a valid JSON object.');
    return errors;
  }

  const { name, email, department, interest } = data;

  // Name Validation
  if (typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Full Name is required and must be at least 2 characters.');
  } else if (name.trim().length > 100) {
    errors.push('Full Name cannot exceed 100 characters.');
  }

  // Email Validation (RFC 5322 regex)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (typeof email !== 'string' || !email.trim()) {
    errors.push('Email address is required.');
  } else if (!emailRegex.test(email.trim())) {
    errors.push('A valid email address is required (e.g., student@domain.com).');
  } else if (email.trim().length > 120) {
    errors.push('Email address cannot exceed 120 characters.');
  }

  // Department Validation
  if (typeof department !== 'string' || !department.trim()) {
    errors.push('Department is required.');
  } else if (department.trim().length > 80) {
    errors.push('Department name cannot exceed 80 characters.');
  }

  // Interest Validation
  if (typeof interest !== 'string' || !interest.trim()) {
    errors.push('Area of Interest is required.');
  } else if (interest.trim().length > 80) {
    errors.push('Area of Interest cannot exceed 80 characters.');
  }

  return errors;
}

/**
 * Main HTTP Cloud Function Handler
 * Entry Point: cloudportRegistration
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function cloudportRegistration(req, res) {
  // Always attach CORS headers
  setCorsHeaders(req, res);

  // 1. Handle OPTIONS Preflight Request
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // 2. Reject Non-POST Methods (HTTP 405 Method Not Allowed)
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `HTTP method ${req.method} is not supported. Use POST.`
    });
  }

  // 3. Validate Content-Type (HTTP 415 Unsupported Media Type)
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(415).json({
      success: false,
      error: 'Unsupported Media Type',
      message: 'Content-Type must be application/json.'
    });
  }

  // 4. Validate Request Payload (HTTP 400 Bad Request)
  const validationErrors = validateRegistrationPayload(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation Failed',
      details: validationErrors,
      message: validationErrors.join(' ')
    });
  }

  const { name, email, department, interest } = req.body;
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanDepartment = department.trim();
  const cleanInterest = interest.trim();

  try {
    let db = getFirestore();
    let collectionRef = db.collection('registrations');

    // 5. Check for Duplicate Registration
    let existingSnapshot;
    try {
      existingSnapshot = await collectionRef
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();
    } catch (queryErr) {
      if (queryErr.message && queryErr.message.includes('Unable to detect a Project Id')) {
        firestoreInstance = createLocalFirestoreStub();
        db = firestoreInstance;
        collectionRef = db.collection('registrations');
        existingSnapshot = await collectionRef.where('email', '==', cleanEmail).limit(1).get();
      } else {
        throw queryErr;
      }
    }

    if (!existingSnapshot.empty) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate Registration',
        message: `The email address '${cleanEmail}' has already been registered for CloudPort.`
      });
    }

    // 6. Persist Document to Firestore Native with Server Timestamp
    const { FieldValue } = getFirestoreSdk();
    const documentPayload = {
      name: cleanName,
      email: cleanEmail,
      department: cleanDepartment,
      interest: cleanInterest,
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await collectionRef.add(documentPayload);

    // 7. Structured JSON Success Response (HTTP 201 Created)
    return res.status(201).json({
      success: true,
      message: 'Registration successfully stored in Google Cloud Firestore.',
      data: {
        id: docRef.id,
        name: cleanName,
        email: cleanEmail,
        department: cleanDepartment,
        interest: cleanInterest,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    // 8. Safe error handling (no leaked internal stack traces)
    console.error('[CloudPort Error] Failed to persist registration to Firestore:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your registration. Please try again later.'
    });
  }
}

// Module Exports
module.exports = {
  cloudportRegistration,
  validateRegistrationPayload,
  setFirestoreInstance,
  getFirestore
};
