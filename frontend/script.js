/**
 * CloudPort — Client-Side Application Script
 * Vanilla JavaScript (ES6+) — Zero external dependencies
 * Google Developer Groups On Campus BPPIMT
 */

(function () {
  'use strict';

  // DOM Elements
  const navbar = document.getElementById('navbar');
  const navLinks = document.getElementById('navLinks');
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinkItems = document.querySelectorAll('.nav-link');
  
  const form = document.getElementById('registrationForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const registerAnotherWrapper = document.getElementById('registerAnotherWrapper');
  const registerAnotherBtn = document.getElementById('registerAnotherBtn');
  
  const formAlert = document.getElementById('formAlert');
  const alertIcon = document.getElementById('alertIcon');
  const alertTitle = document.getElementById('alertTitle');
  const alertMessage = document.getElementById('alertMessage');
  const alertMeta = document.getElementById('alertMeta');
  const alertCloseBtn = document.getElementById('alertCloseBtn');
  const endpointDisplay = document.getElementById('currentEndpointDisplay');

  // Input Fields & Error Elements
  const fields = {
    name: {
      input: document.getElementById('fullName'),
      group: document.getElementById('groupName'),
      error: document.getElementById('errorName'),
      validate: (val) => {
        if (!val || val.trim().length < 2) return 'Please enter your full name (at least 2 characters).';
        if (val.trim().length > 100) return 'Name cannot exceed 100 characters.';
        return null;
      }
    },
    email: {
      input: document.getElementById('email'),
      group: document.getElementById('groupEmail'),
      error: document.getElementById('errorEmail'),
      validate: (val) => {
        if (!val || !val.trim()) return 'Please enter your email address.';
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(val.trim())) return 'Please enter a valid email address (e.g., student@domain.com).';
        if (val.trim().length > 120) return 'Email cannot exceed 120 characters.';
        return null;
      }
    },
    department: {
      input: document.getElementById('department'),
      group: document.getElementById('groupDepartment'),
      error: document.getElementById('errorDepartment'),
      validate: (val) => {
        if (!val || val === '') return 'Please select your department from the list.';
        return null;
      }
    },
    interest: {
      input: document.getElementById('interest'),
      group: document.getElementById('groupInterest'),
      error: document.getElementById('errorInterest'),
      validate: (val) => {
        if (!val || val === '') return 'Please select your primary cloud area of interest.';
        return null;
      }
    }
  };

  // State Management
  let isSubmitting = false;

  // Initialize App
  function init() {
    setupEndpointDisplay();
    setupNavigation();
    setupCountdownTimer();
    setupFormValidation();
    setupAlertDismissal();
  }

  // Live Event Countdown Timer (Saturday, Nov 14, 2026 10:00:00 AM IST)
  function setupCountdownTimer() {
    const elDays = document.getElementById('cdDays');
    const elHours = document.getElementById('cdHours');
    const elMins = document.getElementById('cdMins');
    const elSecs = document.getElementById('cdSecs');

    if (!elDays || !elHours || !elMins || !elSecs) return;

    // Target: Nov 14, 2026, 10:00 AM IST (UTC+05:30)
    const targetDate = new Date('2026-11-14T10:00:00+05:30').getTime();

    function update() {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        elDays.textContent = '00';
        elHours.textContent = '00';
        elMins.textContent = '00';
        elSecs.textContent = '00';
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((distance % (1000 * 60)) / 1000);

      elDays.textContent = String(days).padStart(2, '0');
      elHours.textContent = String(hours).padStart(2, '0');
      elMins.textContent = String(mins).padStart(2, '0');
      elSecs.textContent = String(secs).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
  }

  // Display the active backend endpoint from config.js
  function setupEndpointDisplay() {
    const config = window.CLOUDPORT_CONFIG || {};
    const apiUrl = config.API_URL || 'http://localhost:8080';
    if (endpointDisplay) {
      endpointDisplay.textContent = apiUrl;
      endpointDisplay.title = 'Active Cloud Function API endpoint';
    }
  }

  // Navigation: Mobile Drawer Toggle & Smooth Scroll
  function setupNavigation() {
    if (mobileToggle && navLinks) {
      const toggleMenu = (open) => {
        const isOpen = open !== undefined ? open : !navLinks.classList.contains('nav-open');
        navLinks.classList.toggle('nav-open', isOpen);
        mobileToggle.setAttribute('aria-expanded', String(isOpen));
        // Prevent background body scroll while drawer is open on mobile
        document.body.style.overflow = isOpen ? 'hidden' : '';
      };

      mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
      });

      // Close mobile menu on link click
      navLinkItems.forEach((link) => {
        link.addEventListener('click', () => {
          toggleMenu(false);
        });
      });

      // Close mobile menu on click outside
      document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('nav-open') && !navLinks.contains(e.target) && !mobileToggle.contains(e.target)) {
          toggleMenu(false);
        }
      });

      // Close mobile menu on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('nav-open')) {
          toggleMenu(false);
        }
      });
    }

    // Active Section Tracking via IntersectionObserver
    const sections = document.querySelectorAll('section[id]');
    if ('IntersectionObserver' in window && sections.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              navLinkItems.forEach((link) => {
                const href = link.getAttribute('href');
                if (href === `#${id}`) {
                  link.classList.add('active');
                } else if (href.startsWith('#')) {
                  link.classList.remove('active');
                }
              });
            }
          });
        },
        { threshold: 0.35 }
      );

      sections.forEach((sec) => observer.observe(sec));
    }
  }

  // Live Input Validation Event Listeners
  function setupFormValidation() {
    if (!form) return;

    Object.keys(fields).forEach((key) => {
      const item = fields[key];
      if (!item.input) return;
      const eventType = item.input.tagName.toLowerCase() === 'select' ? 'change' : 'input';

      item.input.addEventListener(eventType, () => {
        // Clear field error on edit
        clearFieldError(key);
      });

      item.input.addEventListener('blur', () => {
        validateSingleField(key);
      });
    });

    // Form Submission
    form.addEventListener('submit', handleFormSubmit);

    // Register Another Attendee
    if (registerAnotherBtn) {
      registerAnotherBtn.addEventListener('click', () => {
        form.reset();
        hideAlert();
        form.style.display = 'flex';
        registerAnotherWrapper.style.display = 'none';
        fields.name.input.focus();
      });
    }
  }

  // Validate a single field
  function validateSingleField(key) {
    const item = fields[key];
    const val = item.input.value;
    const errorMsg = item.validate(val);

    if (errorMsg) {
      showFieldError(key, errorMsg);
      return false;
    } else {
      clearFieldError(key);
      return true;
    }
  }

  function showFieldError(key, msg) {
    const item = fields[key];
    item.group.classList.add('has-error');
    if (item.error) {
      item.error.textContent = msg;
    }
  }

  function clearFieldError(key) {
    const item = fields[key];
    item.group.classList.remove('has-error');
  }

  function clearAllErrors() {
    Object.keys(fields).forEach(clearFieldError);
  }

  // Validate all fields together
  function validateAllFields() {
    let isValid = true;
    let firstInvalidInput = null;

    Object.keys(fields).forEach((key) => {
      const isFieldValid = validateSingleField(key);
      if (!isFieldValid) {
        isValid = false;
        if (!firstInvalidInput) {
          firstInvalidInput = fields[key].input;
        }
      }
    });

    if (firstInvalidInput) {
      firstInvalidInput.focus();
    }

    return isValid;
  }

  // Form Submission Handler
  async function handleFormSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;

    hideAlert();
    clearAllErrors();

    // Client-side validation check
    const isValid = validateAllFields();
    if (!isValid) {
      showAlert(
        'error',
        'Validation Required',
        'Please correct the highlighted fields before submitting your registration.'
      );
      return;
    }

    // Extract payload
    const payload = {
      name: fields.name.input.value.trim(),
      email: fields.email.input.value.trim().toLowerCase(),
      department: fields.department.input.value,
      interest: fields.interest.input.value
    };

    // Transition UI to loading state
    setSubmittingState(true);

    const config = window.CLOUDPORT_CONFIG || {};
    const apiUrl = config.API_URL || 'http://localhost:8080';
    const timeoutMs = config.REQUEST_TIMEOUT_MS || 15000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text || 'Non-JSON response from server' };
        }
      }

      // Check HTTP Status Codes
      if (response.status === 201 || (response.ok && data.success !== false)) {
        // Success State
        const docId = (data.data && data.data.id) || data.registrationId || data.id || 'CONFIRMED';
        const formattedTimestamp = data.data && data.data.createdAt ? new Date(data.data.createdAt).toLocaleString() : new Date().toLocaleString();

        showAlert(
          'success',
          'Registration Confirmed!',
          `Thank you, ${payload.name}! Your registration has been securely saved to Google Cloud Firestore.`,
          `Firestore Document ID: ${docId} • Timestamp: ${formattedTimestamp}`
        );

        form.reset();
        form.style.display = 'none';
        registerAnotherWrapper.style.display = 'block';

      } else if (response.status === 400) {
        // Validation Error from Backend
        const detailMsg = data.error || (Array.isArray(data.details) ? data.details.join(', ') : data.message) || 'Invalid registration data received.';
        showAlert('error', 'Validation Error (HTTP 400)', detailMsg);

      } else if (response.status === 409) {
        // Duplicate Registration
        showAlert(
          'error',
          'Already Registered (HTTP 409)',
          data.message || 'This email address is already registered for CloudPort.'
        );

      } else if (response.status === 405) {
        showAlert('error', 'Method Not Allowed (HTTP 405)', 'The endpoint only accepts HTTP POST requests.');

      } else {
        // Generic Server Error (e.g. 500)
        showAlert(
          'error',
          `Server Error (HTTP ${response.status})`,
          data.error || data.message || 'The server encountered an error processing your registration. Please try again later.'
        );
      }

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        showAlert(
          'error',
          'Request Timeout',
          `The request to ${apiUrl} timed out after ${timeoutMs / 1000}s. Ensure the Google Cloud Function is running and CORS is configured.`
        );
      } else {
        // Network or CORS failure
        showAlert(
          'error',
          'Connection Failed',
          `Could not reach the Cloud Function at ${apiUrl}. Verify your internet connection, confirm the Cloud Function URL in config.js, and verify CORS headers allow this origin.`
        );
      }
    } finally {
      setSubmittingState(false);
    }
  }

  // Update UI Button & Inputs during submission
  function setSubmittingState(submitting) {
    isSubmitting = submitting;

    if (submitting) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      btnText.textContent = 'Saving to Firestore...';
      Object.keys(fields).forEach((k) => {
        fields[k].input.disabled = true;
      });
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      btnText.textContent = 'Complete Registration';
      Object.keys(fields).forEach((k) => {
        fields[k].input.disabled = false;
      });
    }
  }

  // Toast / Alert Display
  function showAlert(type, title, message, meta = '') {
    formAlert.style.display = 'flex';
    formAlert.className = `form-alert alert-${type}`;

    alertTitle.textContent = title;
    alertMessage.textContent = message;

    if (meta) {
      alertMeta.textContent = meta;
      alertMeta.style.display = 'block';
    } else {
      alertMeta.textContent = '';
      alertMeta.style.display = 'none';
    }

    if (type === 'success') {
      alertIcon.textContent = '✅';
    } else {
      alertIcon.textContent = '⚠️';
    }

    // Scroll alert into view smoothly if needed
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    formAlert.style.display = 'none';
  }

  function setupAlertDismissal() {
    if (alertCloseBtn) {
      alertCloseBtn.addEventListener('click', hideAlert);
    }
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
