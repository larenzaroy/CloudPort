/**
 * Automated Test Suite for CloudPort Backend
 * Uses Node.js built-in test runner (node --test) and assertions.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  cloudportRegistration,
  validateRegistrationPayload,
  setFirestoreInstance
} = require('../index.js');

// Mock Response Helper
function createMockResponse() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    set(key, val) {
      res.headers[key.toLowerCase()] = val;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(data) {
      res.body = data;
      return res;
    },
    json(data) {
      res.headers['content-type'] = 'application/json';
      res.body = data;
      return res;
    }
  };
  return res;
}

// Mock Firestore Implementation
function createMockFirestore(options = {}) {
  const registeredEmails = new Set(options.existingEmails || []);

  const mockCollection = {
    where(field, op, val) {
      return {
        limit(num) {
          return {
            async get() {
              const exists = field === 'email' && registeredEmails.has(val);
              return {
                empty: !exists,
                docs: exists ? [{ id: 'doc-existing-123', data: () => ({ email: val }) }] : []
              };
            }
          };
        }
      };
    },
    async add(docData) {
      if (options.shouldThrow) {
        throw new Error('Simulated Firestore Internal Connection Failure');
      }
      registeredEmails.add(docData.email);
      return {
        id: `mock-doc-${Math.floor(Math.random() * 100000)}`
      };
    }
  };

  return {
    collection(name) {
      assert.strictEqual(name, 'registrations');
      return mockCollection;
    }
  };
}

describe('CloudPort Backend - Payload Validation Tests', () => {
  test('Accepts complete valid registration payload', () => {
    const payload = {
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      department: 'Computer Science & Engineering',
      interest: 'Serverless & Cloud Functions'
    };
    const errors = validateRegistrationPayload(payload);
    assert.strictEqual(errors.length, 0);
  });

  test('Rejects null or non-object payloads', () => {
    assert.ok(validateRegistrationPayload(null).length > 0);
    assert.ok(validateRegistrationPayload('string').length > 0);
    assert.ok(validateRegistrationPayload(12345).length > 0);
  });

  test('Rejects missing or invalid full name', () => {
    const errEmpty = validateRegistrationPayload({
      name: ' ',
      email: 'alex@example.com',
      department: 'CSE',
      interest: 'Cloud'
    });
    assert.ok(errEmpty.some(e => e.includes('Full Name is required')));

    const errShort = validateRegistrationPayload({
      name: 'A',
      email: 'alex@example.com',
      department: 'CSE',
      interest: 'Cloud'
    });
    assert.ok(errShort.some(e => e.includes('at least 2 characters')));

    const errLong = validateRegistrationPayload({
      name: 'A'.repeat(105),
      email: 'alex@example.com',
      department: 'CSE',
      interest: 'Cloud'
    });
    assert.ok(errLong.some(e => e.includes('cannot exceed 100 characters')));
  });

  test('Rejects invalid email format', () => {
    const invalidEmails = ['invalid-email', 'user@', '@domain.com', 'user@domain', 'user name@domain.com'];
    for (const email of invalidEmails) {
      const errors = validateRegistrationPayload({
        name: 'Alex Doe',
        email,
        department: 'Information Technology',
        interest: 'Serverless'
      });
      assert.ok(errors.some(e => e.includes('valid email address')), `Failed for email: ${email}`);
    }
  });

  test('Rejects missing department or area of interest', () => {
    const errors = validateRegistrationPayload({
      name: 'Alex Doe',
      email: 'alex.doe@example.com',
      department: '',
      interest: '   '
    });
    assert.ok(errors.some(e => e.includes('Department is required')));
    assert.ok(errors.some(e => e.includes('Area of Interest is required')));
  });
});

describe('CloudPort Backend - Cloud Function HTTP Handler Tests', () => {
  beforeEach(() => {
    // Reset to mock Firestore before each test
    setFirestoreInstance(createMockFirestore());
  });

  test('Handles OPTIONS preflight request with 204 status and CORS headers', async () => {
    const req = {
      method: 'OPTIONS',
      headers: {
        origin: 'https://storage.googleapis.com'
      }
    };
    const res = createMockResponse();

    await cloudportRegistration(req, res);

    assert.strictEqual(res.statusCode, 204);
    assert.ok(res.headers['access-control-allow-origin']);
    assert.strictEqual(res.headers['access-control-allow-methods'], 'POST, OPTIONS');
    assert.ok(res.headers['access-control-allow-headers'].includes('Content-Type'));
  });

  test('Rejects non-POST methods with HTTP 405 Method Not Allowed', async () => {
    const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

    for (const method of methods) {
      const req = { method, headers: {} };
      const res = createMockResponse();

      await cloudportRegistration(req, res);

      assert.strictEqual(res.statusCode, 405);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error, 'Method Not Allowed');
    }
  });

  test('Rejects non-JSON content-type with HTTP 415 Unsupported Media Type', async () => {
    const req = {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'plain text data'
    };
    const res = createMockResponse();

    await cloudportRegistration(req, res);

    assert.strictEqual(res.statusCode, 415);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Unsupported Media Type');
  });

  test('Rejects invalid input payload with HTTP 400 Bad Request', async () => {
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        name: 'A', // too short
        email: 'invalid-email',
        department: '',
        interest: ''
      }
    };
    const res = createMockResponse();

    await cloudportRegistration(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Validation Failed');
    assert.ok(Array.isArray(res.body.details));
    assert.ok(res.body.details.length >= 3);
  });

  test('Successfully processes valid registration and returns HTTP 201 Created', async () => {
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        name: 'Jordan Lee',
        email: 'jordan.lee@bppimt.edu.in',
        department: 'Electronics & Communication',
        interest: 'Cloud Security & IAM Best Practices'
      }
    };
    const res = createMockResponse();

    await cloudportRegistration(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id.startsWith('mock-doc-'));
    assert.strictEqual(res.body.data.email, 'jordan.lee@bppimt.edu.in');
    assert.strictEqual(res.body.data.name, 'Jordan Lee');
    assert.ok(res.body.data.createdAt);
  });

  test('Rejects duplicate email registrations with HTTP 409 Conflict', async () => {
    setFirestoreInstance(createMockFirestore({
      existingEmails: ['alex.alreadyregistered@example.com']
    }));

    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        name: 'Alex Already Registered',
        email: 'alex.alreadyregistered@example.com',
        department: 'Computer Science & Engineering',
        interest: 'Serverless & Cloud Functions'
      }
    };
    const res = createMockResponse();

    await cloudportRegistration(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Duplicate Registration');
  });

  test('Safely handles unexpected Firestore failures with HTTP 500 without leaking stack traces', async () => {
    // Inject a crashing firestore client
    setFirestoreInstance(createMockFirestore({ shouldThrow: true }));

    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        name: 'Taylor Swift',
        email: 'taylor@example.com',
        department: 'Information Technology',
        interest: 'NoSQL Data Modeling with Firestore'
      }
    };
    const res = createMockResponse();

    await cloudportRegistration(req, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Internal Server Error');
    // Ensure no internal stack trace leaked to the client
    assert.strictEqual(res.body.stack, undefined);
    assert.strictEqual(res.body.message.includes('Simulated Firestore Internal Connection Failure'), false);
  });
});
