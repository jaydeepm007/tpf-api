import { Injectable } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { decryptUsingAES256, encryptUsingAES256 } from '../../utils/crypto';
import * as bcrypt from 'bcryptjs';
import { MailerService } from '../../mailer/mailer.service';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const API_DOMAIN = process.env.API_DOMAIN || 'http://localhost:3000';

@Injectable()
export class ApiService {
  sendEncryptedResponse(res: Response, payload: any, status = 200) {
    const json = JSON.stringify(payload);
    const cipher = encryptUsingAES256(json);
    res.status(status).json(cipher);
  }

  normalizeExpiresIn(): string | number {
    const val = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRES;
    if (!val) return '1h';
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    return val;
  }

  getServiceToken() {
    const payload = { iss: 'tpf-backend', scope: 'service' };
    return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
      expiresIn: this.normalizeExpiresIn(),
    });
  }

  getAuthHeaderForReq(input: any) {
    if (!input) return null;
    try {
      let candidate: any = input;
      if (typeof candidate === 'string') {
        const dec = decryptUsingAES256(candidate);
        try { return JSON.parse(dec); } catch { return dec; }
      }
      if (candidate && typeof candidate === 'object' && candidate.data) {
        const dec = decryptUsingAES256(candidate.data);
        try { return JSON.parse(dec); } catch { return dec; }
      }
      return candidate;
    } catch (err) {
      console.log('getAuthHeaderForReq decryption/parse error:', err);
      return null;
    }
  }

  verifyToken(token: string) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      return true;
    } catch (err) {
      return null;
    }
  }

  async getPublicToken() {
    const payload = { iss: 'tpf-backend', scope: 'public' };
    return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
      expiresIn: this.normalizeExpiresIn(),
    });
  }

  async login(body: any) {
    const { email, password } = body || {};
    if (!email || !password) return { status: 400, body: { error: 'email and password required' } };
    try {
      const q = `SELECT id, email, role_id, first_name, last_name, password FROM public.tpf_users WHERE email = $1 LIMIT 1`;
      const { rows } = await pool.query(q, [email]);
      if (!rows.length) return { status: 401, body: { error: 'invalid credentials' } };
      const user = rows[0];
      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) return { status: 401, body: { error: 'invalid credentials' } };

      const payload = { role: 'web_user', user_id: user.id, email: user.email };
      let access: any[] = [];
      let accessIds: number[] = [];
      if (user.role_id) {
        const auth = `SELECT id, role_id, authorization_id FROM public.tpf_role_authorizations WHERE role_id = $1`;
        const { rows: authRows } = await pool.query(auth, [user.role_id]);
        if (authRows.length) {
          accessIds = authRows.map((r: any) => r.authorization_id);
          const authDetailsQ = `SELECT id, name, attribute_name, resource_name, locale_en FROM public.tpf_authorizations WHERE id = ANY($1::int[])`;
          const { rows: authDetailsRows } = await pool.query(authDetailsQ, [accessIds]);
          access = authDetailsRows;
        }
      }
      const jwtSecret: any = process.env.JWT_SECRET || 'default_secret';
      const token = jwt.sign(payload, jwtSecret, { algorithm: 'HS256', expiresIn: this.normalizeExpiresIn() });
      return { status: 200, body: { token, access, user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role_id: user.role_id } } };
    } catch (err) {
      console.error(err);
      return { status: 500, body: { error: 'server error' } };
    }
  }

  async fetchFromApi(pathWithQuery: string) {
    const response = await fetch(`${API_DOMAIN}${pathWithQuery}`);
    return await response.json();
  }

  async fetchNavHistory(payload: any) {
    const fromDate = payload?.FromDate;
    const toDate = payload?.ToDate;
    const params = new URLSearchParams();
    if (fromDate) params.append('nav_date', `gte.${fromDate}`);
    if (toDate) params.append('nav_date', `lte.${toDate}`);
    const url = `${API_DOMAIN}/tpf_nav_history?${params.toString()}`;
    const response = await fetch(url);
    return await response.json();
  }

  async fetchDocuments(payload: any) {
    const documentCategoryId = payload?.document_category_id;
    if (documentCategoryId > 0) {
      const response = await fetch(`${API_DOMAIN}/tpf_documents?document_category_id=eq.${documentCategoryId}&is_active=eq.true&select=*,tpf_document_sub_categories(*)`);
      return await response.json();
    }
    return [];
  }

  async sendMailNavUpdate(body: any, token?: string) {
    if (!token || !this.verifyToken(token)) {
      return { status: 401, body: { error: 'Unauthorized: invalid or missing token' } };
    }
    const payload = body;
    const schemesIds = payload?.id;
    const schemesQ = `SELECT * from tpf_schemes WHERE id = $1`;
    const { rows: schemesRows } = await pool.query(schemesQ, [schemesIds]);
    if (!schemesRows.length) {
      return { status: 404, body: { error: 'No schemes found for the given IDs' } };
    }
    const authQ = `SELECT u.id, u.email FROM public.tpf_users u
      JOIN public.tpf_role_authorizations ra ON u.role_id = ra.role_id
      JOIN public.tpf_authorizations a ON ra.authorization_id = a.id
      WHERE a.name = $1`;
    const { rows: usersRows } = await pool.query(authQ, ['update_schemes_status']);
    const emails = usersRows.map((u: any) => u.email);
    const mailerService = new MailerService();
    const schemeTable = schemesRows.map((scheme: any) => `<tr>
      <td>${scheme.id}</td>
      <td>${scheme.scheme_name}</td>
      <td>${scheme.modified_nav}</td>
      <td>${scheme.modified_nav_date}</td>
    </tr>`).join('');
    await mailerService.sendMail({
      to: emails,
      subject: 'NAV Update',
      template: 'nav',
      context: { DataTable: schemeTable, DATE: new Date().toLocaleDateString() },
    });
    return { status: 200, body: { success: true, message: 'Email sent to users', emails } };
  }

  async contactUs(payloadRaw: any) {
    let payload: any = payloadRaw;
    if (typeof payloadRaw === 'string') {
      try { payload = JSON.parse(payloadRaw); } catch { return { error: 'Invalid payload: expected JSON object' }; }
    }
    if (!payload || typeof payload !== 'object') return { error: 'Invalid payload: expected object' };

    try {
      const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Prefer': 'return=representation' };
      if (process.env.USE_SERVICE_TOKEN === '1') headers['Authorization'] = `Bearer ${this.getServiceToken()}`;
      payload.create_date = new Date().toISOString();
      const response = await fetch(`${API_DOMAIN}/tpf_contact_us`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const text = await response.text();
      let result: any;
      if (!text) result = { status: response.status, ok: response.ok };
      else {
        try { result = JSON.parse(text); } catch { result = text; }
      }
      const authQ = `SELECT u.id, u.email FROM public.tpf_users u
        JOIN public.tpf_role_authorizations ra ON u.role_id = ra.role_id
        JOIN public.tpf_authorizations a ON ra.authorization_id = a.id
        WHERE a.name = $1`;
      const { rows: usersRows } = await pool.query(authQ, ['receive_mail_on_contact_us']);
      const emails = usersRows.map((user: any) => user.email);
      if (emails.length > 0) {
        const mailerService = new MailerService();
        await mailerService.sendMail({
          to: emails,
          subject: 'New Contact Us Submission',
          template: 'contact_us',
          context: { NAME: payload.full_name, EMAIL: payload.email, PHONE: payload.phone, MESSAGE: payload.note },
        });
      }
      return result;
    } catch (err) {
      return { error: String(err) };
    }
  }

  getRoutes(_: Request) {
    // In Nest the router stack differs; provide a static route list reflecting this controller
    const routes = [
      { method: 'GET', path: '/api/token' },
      { method: 'POST', path: '/api/login' },
      { method: 'GET', path: '/api/schemes' },
      { method: 'POST', path: '/api/nav-history' },
      { method: 'POST', path: '/api/documents' },
      { method: 'GET', path: '/api/document-categories' },
      { method: 'POST', path: '/api/send-mail-nav-update' },
      { method: 'POST', path: '/api/contact-us' },
      { method: 'GET', path: '/api/routes' },
    ];
    return { count: routes.length, routes };
  }
}
