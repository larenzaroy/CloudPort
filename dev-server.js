/**
 * CloudPort — Local Full-Stack Development Server
 * 
 * Serves on port 8080:
 *   - GET  /              → Serves frontend/index.html (no more HTTP 405 when visiting localhost:8080)
 *   - GET  /*.css, *.js   → Serves frontend static assets
 *   - POST /              → Executes Google Cloud Function handler (cloudportRegistration)
 *   - OPTIONS /           → Executes CORS preflight (HTTP 204 No Content)
 *   - GET  /cloudportRegistration → Returns HTTP 405 Method Not Allowed (Cloud Function behavior)
 * 
 * Google Developer Groups On Campus BPPIMT
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { cloudportRegistration } = require('./backend/index.js');

const PORT = process.env.PORT || 8080;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

// Polyfill express-like response methods for Cloud Function compatibility
function polyfillRes(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.set = function (header, val) {
    res.setHeader(header, val);
    return res;
  };
  res.json = function (obj) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = function (data) {
    res.end(data);
    return res;
  };
  return res;
}

// Dispatch request to Cloud Function handler
async function dispatchToCloudFunction(req, res) {
  polyfillRes(res);
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    try {
      req.body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      req.body = rawBody;
    }

    try {
      await cloudportRegistration(req, res);
    } catch (err) {
      console.error('[Cloud Function Uncaught Exception]', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while processing your registration.'
        }));
      }
    }
  });
}

// Serve frontend static files
function serveStaticFile(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/register' || reqPath === '/register/') {
    reqPath = '/register.html';
  }

  let filePath = path.join(FRONTEND_DIR, reqPath);

  // If file doesn't exist directly, check if appending .html matches
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  // Directory traversal guard
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html
      const indexPath = path.join(FRONTEND_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Create unified server on port 8080
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // 1. All POST requests are handled by the Cloud Function (Form Submissions)
  if (req.method === 'POST') {
    return dispatchToCloudFunction(req, res);
  }

  // 2. OPTIONS requests are handled by the Cloud Function (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return dispatchToCloudFunction(req, res);
  }

  // 3. Explicit API endpoint paths (e.g. /cloudportRegistration or /api/*) on GET return 405 Method Not Allowed
  if (urlPath === '/cloudportRegistration' || urlPath.startsWith('/api')) {
    return dispatchToCloudFunction(req, res);
  }

  // 4. Any non-GET, non-HEAD methods (PUT, DELETE, PATCH) return 405 Method Not Allowed
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return dispatchToCloudFunction(req, res);
  }

  // 5. GET requests to root or website assets serve the frontend
  serveStaticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`  CloudPort Application is RUNNING on http://localhost:${PORT}`);
  console.log(`  - Frontend Landing Page:  GET  http://localhost:${PORT}`);
  console.log(`  - Cloud Function Handler: POST http://localhost:${PORT}`);
  console.log(`  - CORS Preflight:         OPTIONS http://localhost:${PORT}`);
  console.log(`================================================================\n`);
});
