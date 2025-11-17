import { Router, Request, Response, NextFunction } from 'express';
import { decryptUsingAES256, encryptUsingAES256 } from '../utils/crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

// add API domain from env
const API_DOMAIN = process.env.API_DOMAIN || 'http://localhost:3200';

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

// helper: derive Authorization header - prefer token from decrypted payload if provided
function getAuthHeaderForReq(req: Request) {
  // check for decrypted token payload shapes: { Authorization: { Token } } or { token } or { authorization: { token } }
  const decoded: any = decryptUsingAES256(req as any);
  console.log('Decoded auth payload:', decoded);
  return decoded ||
         null;
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

router.get('/current-nav', async (req: Request, res: Response) => {
  try {
    const payload = getAuthHeaderForReq(req?.body?.payload);
    let derivedToken = payload?.token;
    if (derivedToken && derivedToken.startsWith('"') && derivedToken.endsWith('"')) {
      derivedToken = derivedToken.slice(1, -1);
    }
    if (!derivedToken) {
      return sendEncrypted(res, { token_error: 'Unauthorized: missing token' });
    } 
    if (verifyToken(derivedToken) === null) {
      return sendEncrypted(res, { token_error: 'Unauthorized: invalid token' });
    }
    const response = await fetch(`${API_DOMAIN}/tpf_trn_nav_current`);
    const rows = await response.json();
    return sendEncrypted(res, { rows });  
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

router.get('/nav-history', async (req: Request, res: Response) => {
  const payload = getAuthHeaderForReq(req?.body?.payload);
  let derivedToken = payload?.token;
  if (derivedToken && derivedToken.startsWith('"') && derivedToken.endsWith('"')) {
    derivedToken = derivedToken.slice(1, -1);
  }
  try {
    if (!derivedToken) {
      return sendEncrypted(res, { token_error: 'Unauthorized: missing token' });
    } 
    if (verifyToken(derivedToken) === null) {
      return sendEncrypted(res, { token_error: 'Unauthorized: invalid token' });
    }
    const response = await fetch(`${API_DOMAIN}/tpf_trn_nav_history`);
    const rows = await response.json();
    return sendEncrypted(res, { rows });  
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

router.get('/documents', async (req: Request, res: Response) => {
  const payload = getAuthHeaderForReq(req?.body?.payload);
  let derivedToken = payload?.token;
  const documentCategoryId = payload?.document_category_id;
  if (derivedToken && derivedToken.startsWith('"') && derivedToken.endsWith('"')) {
    derivedToken = derivedToken.slice(1, -1);
  }

  try {
    if (!derivedToken) {
      return sendEncrypted(res, { token_error: 'Unauthorized: missing token' });
    }
    if (verifyToken(derivedToken) === null) {
      return sendEncrypted(res, { token_error: 'Unauthorized: invalid token' });
    }
    let rows: any;
    if (documentCategoryId > 0) {
        const response = await fetch(`${API_DOMAIN}/tpf_documents?document_category_id=eq.${documentCategoryId}&is_active=eq.true`);
        rows = await response.json();
        return sendEncrypted(res, { rows });
    } else {
      rows = [];
    }
    return sendEncrypted(res, { rows });
  } catch (err) {
    return sendEncrypted(res, { error: String(err) });
  }
});

router.get('/document-categories', async (req: Request, res: Response) => {
  const payload = getAuthHeaderForReq(req?.body?.payload);
  let derivedToken = payload?.token;
  if (derivedToken && derivedToken.startsWith('"') && derivedToken.endsWith('"')) {
    derivedToken = derivedToken.slice(1, -1);
  }
  try {
    if (!derivedToken) {
      return sendEncrypted(res, { token_error: 'Unauthorized: missing token' });
    }
    if (verifyToken(derivedToken) === null) {
      return sendEncrypted(res, { token_error: 'Unauthorized: invalid token' });
    }
    const response = await fetch(`${API_DOMAIN}/tpf_document_categories?is_active=eq.true`);
    const rows = await response.json();
        return sendEncrypted(res, { rows });
        // return res.json({ rows });
    } catch (err) {
        return sendEncrypted(res, { error: String(err) });
        // return { error: String(err) };
    }   
});

export default router;
