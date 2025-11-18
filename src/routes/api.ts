import { Router, Request, Response, NextFunction } from 'express';
import { decryptUsingAES256, encryptUsingAES256 } from '../utils/crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

// add API domain from env
const API_DOMAIN = process.env.API_DOMAIN || 'http://localhost:3000';

function sendEncrypted(res: Response, payload: any) {
  const json = JSON.stringify(payload);
  const cipher = encryptUsingAES256(json);
  // return consistent shape expected by clients
  return res.json(cipher);
}

// helper: generate a short-lived server JWT for backend->backend calls
function getServiceToken() {
  const payload = { iss: 'tpf-backend', scope: 'service' };
  return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

// --- new: router-level raw body reader ---
router.use((req: Request, _res: Response, next: NextFunction) => {
  // if some body-parser already populated req.body, skip
  if (req.body !== undefined && req.body !== null && Object.keys(req.body as any).length !== 0) {
    return next();
  }

  let raw = '';
  req.setEncoding('utf8');

  req.on('data', (chunk) => {
    raw += chunk;
  });

  req.on('end', () => {
    if (!raw) {
      // no body stream, leave as-is
      return next();
    }
    // try to parse JSON first, otherwise keep raw string (likely encrypted payload)
    try {
      (req as any).body = JSON.parse(raw);
    } catch (e) {
      (req as any).body = raw;
    }
    next();
  });

  req.on('error', () => next());
});
// --- end raw body reader ---

// helper: derive Authorization header - prefer token from decrypted payload if provided
function getAuthHeaderForReq(input: any) {
  // input may be: raw encrypted string, an object like { data: '...' }, or already-decoded object
  if (!input) return null;

  try {
    let candidate: any = input;

    if (typeof candidate === 'string') {
      // raw encrypted payload -> decrypt
      const dec = decryptUsingAES256(candidate);
      try {
        return JSON.parse(dec);
      } catch {
        return dec; // return raw decrypted string if not JSON
      }
    }

    // if object with data property containing encrypted string
    if (candidate && typeof candidate === 'object' && candidate.data) {
      const dec = decryptUsingAES256(candidate.data);
      try {
        return JSON.parse(dec);
      } catch {
        return dec;
      }
    }

    // already an object (possibly decrypted at earlier middleware)
    return candidate;
  } catch (err) {
    console.log('getAuthHeaderForReq decryption/parse error:', err);
    return null;
  }
}

//Verify Token
function verifyToken(token: string) {
    console.log('Verifying token:', token);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    console.log('Decoded token:', decoded);
    return true;
  } catch (err) {
    console.log('Decoded token:', err);
    return null;
  }
}

// middleware: if body.data is present, decrypt and replace req.body.decoded
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && (req.body as any).data) {
    try {
      const dec = decryptUsingAES256((req.body as any).data);
      // assume decrypted JSON string
      (req as any).decoded = JSON.parse(dec);
    } catch (err) {
      // ignore decryption errors for public API
      (req as any).decoded = null;
    }
  }
  next();
});

// GET /token -> returns a signed JWT (public, no login)
router.get('/token', (_req: Request, res: Response) => {
  const payload = { iss: 'tpf-backend', scope: 'public' };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
  return sendEncrypted(res, token );
//   return res.json({ token });
});

router.get('/schemes', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${API_DOMAIN}/tpf_schemes`);
    const rows = await response.json();
    return sendEncrypted(res, rows);  
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

router.post('/nav-history', async (req: Request, res: Response) => {
  const payload = getAuthHeaderForReq(req?.body);
  const fromDate = payload?.FromDate;
  const toDate = payload?.ToDate;
  console.log('Fetching NAV history with fromDate:', fromDate, 'toDate:', toDate);
  try {
    const params = new URLSearchParams();
    if (fromDate) params.append('nav_date', `gte.${fromDate}`);
    if (toDate) params.append('nav_date', `lte.${toDate}`);
    const url = `${API_DOMAIN}/tpf_nav_history?${params.toString()}`;
    const response = await fetch(url);
    const rows = await response.json();
    return sendEncrypted(res, rows);  
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

router.post('/documents', async (req: Request, res: Response) => {
  const payload = getAuthHeaderForReq(req?.body);

  console.log('Payload in /documents:', payload);
  const documentCategoryId = payload?.document_category_id;
  try {
    let rows: any;
    if (documentCategoryId > 0) {
        // documents by sub category name
        const response = await fetch(`${API_DOMAIN}/tpf_documents?document_category_id=eq.${documentCategoryId}&is_active=eq.true&select=*,tpf_document_sub_categories(*)`);
        rows = await response.json();
        return sendEncrypted(res, rows);
    } else {
      rows = [];
    }
    return sendEncrypted(res, rows);
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

router.get('/document-categories', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${API_DOMAIN}/tpf_document_categories?is_active=eq.true`);
    const rows = await response.json();
        return sendEncrypted(res, rows );
        // return res.json({ rows });
    } catch (err) {
        return sendEncrypted(res, { error: String(err) });
        // return { error: String(err) };
    }   
});

//  POST contact-us -> creates a contact us entry
router.post('/contact-us', async (req: Request, res: Response) => {
    const payload = getAuthHeaderForReq(req?.body);
    try {
        const response = await fetch(`${API_DOMAIN}/tpf_contact_us`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        return sendEncrypted(res, result);
    } catch (err) {
        return sendEncrypted(res, { error: String(err) });
    }
  }
);

// GET /routes -> returns a list of registered routes and a count
router.get('/routes', (req: Request, res: Response) => {
  try {
    const stack = (router as any).stack || [];
    const routes: { method: string; path: string }[] = [];

    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const path = layer.route.path;
        const methods = layer.route.methods || {};
        const method = Object.keys(methods).find((m) => methods[m])?.toUpperCase() || 'GET';
        routes.push({ method, path });
      }
    }

    const payload = { count: routes.length, routes };

    // allow plain JSON when explicitly requested (or when running tests)
    const rawQuery = (req.query as any)?.raw;
    const headerRaw = (req.header('x-return-plain') || '').toLowerCase();
    const returnPlain =
      process.env.NODE_ENV === 'test' ||
      rawQuery === '1' ||
      rawQuery === 'true' ||
      headerRaw === '1' ||
      headerRaw === 'true';

    if (returnPlain) {
      return res.json(payload);
    }
    return sendEncrypted(res, payload);
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

export default router;
