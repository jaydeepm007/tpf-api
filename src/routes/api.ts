import { Router, Request, Response, NextFunction } from 'express';
import { decryptUsingAES256, encryptUsingAES256 } from '../utils/crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { first } from 'rxjs';
import * as bcrypt from "bcryptjs";
import { MailerService } from '../mailer/mailer.service';
import { ConfigService } from '@nestjs/config/dist/config.service';
import path from 'path';
import fs from 'fs';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const router = Router();

// add API domain from env
const API_DOMAIN = process.env.API_DOMAIN || 'http://localhost:3000';

function sendEncrypted(res: Response, payload: any) {
  const json = JSON.stringify(payload);
  const cipher = encryptUsingAES256(json);
  // return consistent shape expected by clients
  return res.json(cipher);
}

// helper: ensure expiresIn is a number (seconds) or a timespan string accepted by jsonwebtoken
function normalizeExpiresIn(): string | number {
	// prefer new name, fall back to old name for compatibility
	const val = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRES;
	if (!val) return '1h'; // default
	// if value is purely digits, treat as seconds (number)
	if (/^\d+$/.test(val)) {
		return parseInt(val, 10);
	}
	// otherwise return as string (e.g. "1h", "15m")
	return val;
}

// helper: generate a short-lived server JWT for backend->backend calls
function getServiceToken() {
  const payload = { iss: 'tpf-backend', scope: 'service' };
  return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: normalizeExpiresIn(),
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
    expiresIn: normalizeExpiresIn(),
  });
  return sendEncrypted(res, token );
//   return res.json({ token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const q = `SELECT id, email, role_id, first_name, last_name, password FROM public.tpf_users WHERE email = $1 LIMIT 1`;
    const { rows } = await pool.query(q, [email]);
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });

    const user = rows[0];
    console.log('Comparing password for user:', user.password, password);
    const storedHash = user.password;
    const passwordMatches = await bcrypt.compare(password, storedHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const payload = {
      role: 'web_user',   // or 'web_admin' for admins — ensure mapping in DB roles
      user_id: user.id,
      email: user.email
    };
    let access = [];
    let accessIds: number[] = [];
    console.log('Fetching role authorizations for role_id:', user.role_id);
    if (user.role_id) {
      const auth = `SELECT id, role_id, authorization_id FROM public.tpf_role_authorizations WHERE role_id = $1`;
      const { rows } = await pool.query(auth, [user.role_id]);

      if (rows.length) {
        access = rows.map((row: any) => row.authorization_id);
        accessIds = access;

        const authDetailsQ = `SELECT id, name, attribute_name, resource_name, locale_en FROM public.tpf_authorizations WHERE id = ANY($1::int[])`;
        const { rows: authDetailsRows } = await pool.query(authDetailsQ, [accessIds]);
        access = authDetailsRows;
      }
    }

    const jwtSecret: any = process.env.JWT_SECRET || 'default_secret';
    console.log('Signing JWT with secret:', jwtSecret);
    const token = jwt.sign(payload, jwtSecret, {
      algorithm: 'HS256',     // 👈 REQUIRED
      expiresIn: normalizeExpiresIn()  // example: "1h"
    });

    return res.status(200).json({ token: token, access: access, user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role_id: user.role_id } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
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

router.post('/send-mail-nav-update', async (req: Request, res: Response) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing token' });
    }
    const payload = req?.body;
    const schemesIds = payload?.id;
    // fetch tpf_schemes for the given ids
      const schemes = `SELECT * from tpf_schemes WHERE id = $1`;
      const { rows: schemesRows } = await pool.query(schemes, [schemesIds]);

      if (schemesRows.length) {
        // fetch the users who has the access to 'update_schemes_status'
        const authQ = `SELECT u.id, u.email FROM public.tpf_users u
          JOIN public.tpf_role_authorizations ra ON u.role_id = ra.role_id
          JOIN public.tpf_authorizations a ON ra.authorization_id = a.id
          WHERE a.name = $1`; 
        const { rows: usersRows } = await pool.query(authQ, ['update_schemes_status']);
        const emails = usersRows.map((user: any) => user.email);
        // send mail using mailer service
        const mailerService = new MailerService();
        // format scheme.modified_nav_date for email dd/mm/yyyy
        const formattedDate = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-GB');
        }
        const schemeTable = schemesRows.map((scheme: any) => {
          return `<tr>
            <td>${scheme.id}</td>
            <td>${scheme.scheme_name}</td>
            <td>${scheme.modified_nav}</td>
            <td>${formattedDate(scheme.modified_nav_date)}</td>
          </tr>`;
        }).join('');
        // console.log('Generated schemeTable HTML:', schemeTable);
        // use template from mailer/templates/nav.html and replace {{DataTable}} with schemeTable and Date
        await mailerService.sendMail({
          to: emails,
          subject: 'NAV Update',
          template: 'nav',
          context: { DataTable: schemeTable, DATE: formattedDate(schemesRows[0].modified_nav_date) },
        });
        // if mail sent successfully
        return res.status(200).json({ success: true, message: 'Email sent to users', emails: emails });
      } else {
        return res.status(404).json({ error: 'No schemes found for the given IDs' });
      }

  } catch (err) {
      return res.status(500).json({ error: String(err) });
      // return { error: String(err) };
  }   
});

//  POST contact-us -> creates a contact us entry
router.post('/contact-us', async (req: Request, res: Response) => {
    const payloadRaw = getAuthHeaderForReq(req?.body);
    console.log('Received /contact-us payload:', payloadRaw);

    // Ensure payload is an object (parse if it's a JSON string)
    let payload: any = payloadRaw;
    if (typeof payloadRaw === 'string') {
        try {
            payload = JSON.parse(payloadRaw);
        } catch (err) {
            console.error('Invalid /contact-us payload (not JSON):', err);
            return sendEncrypted(res, { error: 'Invalid payload: expected JSON object' });
        }
    }

    if (!payload || typeof payload !== 'object') {
        return sendEncrypted(res, { error: 'Invalid payload: expected object' });
    }

    try {
        const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            // ask PostgREST to return the created representation (so response body is JSON)
            'Prefer': 'return=representation',
        };
        // optionally include a service token for backend->backend auth
        if (process.env.USE_SERVICE_TOKEN === '1') {
            headers['Authorization'] = `Bearer ${getServiceToken()}`;
        }
        payload.create_date = new Date().toISOString();
        const printPayload = { ...payload };
        console.log('Creating contact us entry with payload:', printPayload); 

        const response = await fetch(`${API_DOMAIN}/tpf_contact_us`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        // robust parsing: handle empty responses (204/201 with no body) and non-JSON bodies
        const text = await response.text();
        let result: any;
        if (!text) {
            result = { status: response.status, ok: response.ok };
        } else {
            try {
                result = JSON.parse(text);
            } catch {
                result = text;
            }
        }

        console.log('Contact us entry created:', result);
        const authQ = `SELECT u.id, u.email FROM public.tpf_users u
          JOIN public.tpf_role_authorizations ra ON u.role_id = ra.role_id
          JOIN public.tpf_authorizations a ON ra.authorization_id = a.id
          WHERE a.name = $1`; 
        const { rows: usersRows } = await pool.query(authQ, ['receive_mail_on_contact_us']);
        const emails = usersRows.map((user: any) => user.email);
        console.log('Contact us notification will be sent to emails:', emails, payload);
        if (emails.length > 0) {
            // send mail using mailer service
            const mailerService = new MailerService();
            await mailerService.sendMail({
                to: emails,
                subject: 'New Contact Us Submission',
                template: 'contact_us',
                context: { NAME: printPayload.full_name, EMAIL: printPayload.email, PHONE: printPayload.phone, MESSAGE: printPayload.note },
            });
            console.log('Contact us notification email sent to:', emails);
        }
        return sendEncrypted(res, result);
    } catch (err) {
        console.error('Error in /contact-us:', err);
        return sendEncrypted(res, { error: String(err) });
    }
});



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
