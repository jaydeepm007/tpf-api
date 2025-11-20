import { Controller, Get, Post, Body, Req, Res, Headers, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiService } from '../services/api.service';
import { decryptUsingAES256 } from '../utils/crypto';

// NOTE: This file is now a NestJS Controller delegating to ApiService
@Controller('api')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  // new: centralized helper so all endpoints behave the same
  private tryParseJsonMaybe(text: string) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private tryBase64Decode(text: string) {
    try {
      return Buffer.from(text, 'base64').toString('utf8');
    } catch (err) {
      console.log('base64 decode failed:', err);
      return null;
    }
  }

  // local fallback parser (keeps previous robust behavior + rawBody check)
  private localParseFallback(input: any, req?: Request) {
    const tryParseJsonMaybe = (text: string) => {
      try { return JSON.parse(text); } catch { return null; }
    };
    const tryBase64Decode = (text: string) => {
      try { return Buffer.from(text, 'base64').toString('utf8'); } catch { return null; }
    };

    // examine provided input first
    const tryCandidate = (candidate: any) => {
      if (!candidate) return null;
      if (typeof candidate === 'object' && !candidate.data) return candidate;
      if (typeof candidate === 'string') {
        try {
          const dec = decryptUsingAES256(candidate);
          if (dec) return tryParseJsonMaybe(dec) ?? dec;
        } catch { /* ignore */ }
        const b64 = tryBase64Decode(candidate);
        if (b64) return tryParseJsonMaybe(b64) ?? b64;
        // final fallback: raw string
        return candidate;
      }
      if (typeof candidate === 'object' && candidate.data) {
        const raw = candidate.data;
        try {
          const dec = decryptUsingAES256(raw);
          if (dec) return tryParseJsonMaybe(dec) ?? dec;
        } catch { /* ignore */ }
        const b64 = tryBase64Decode(raw);
        if (b64) return tryParseJsonMaybe(b64) ?? b64;
        return raw;
      }
      return null;
    };

    let out = tryCandidate(input);
    if (out) return out;

    // check express raw body (if middleware populated it) - common key used by some setups
    const anyReq = req as any;
    const rawCandidates = [
      anyReq?.rawBody,
      anyReq?.body, // sometimes body is string
      anyReq?.body?.data,
      anyReq?.body?.toString && typeof anyReq.body === 'object' ? anyReq.body.toString() : null
    ];
    for (const c of rawCandidates) {
      if (!c) continue;
      out = tryCandidate(c);
      if (out) return out;
    }

    return null;
  }

  @Get('token')
  async getToken(@Res() res: Response) {
    try {
      const token = await this.apiService.getPublicToken();
      return this.apiService.sendEncryptedResponse(res, token);
    } catch (err) {
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('login')
  async login(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    try {
      console.log('Received /login request with body:', body);
      const result = await this.apiService.login(body);
      return res.status(result.status || 200).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  @Get('schemes')
  async getSchemes(@Res() res: Response) {
    try {
      const rows = await this.apiService.fetchFromApi(`/tpf_schemes`);
      return this.apiService.sendEncryptedResponse(res, rows);
    } catch (err) {
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('nav-history')
  async navHistory(@Req() req: Request, @Body() body: any, @Res() res: Response) {
    try {
      let payload = this.apiService.getAuthHeaderForReq(body);
      if (!payload) {
        payload = this.localParseFallback(body, req);
        console.log('nav-history: used fallback parser, payload:', payload);
      } else {
        console.log('nav-history: used service parser, payload:', payload);
      }
      const rows = await this.apiService.fetchNavHistory(payload);
      return this.apiService.sendEncryptedResponse(res, rows);
    } catch (err) {
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('documents')
  async documents(@Req() req: Request, @Body() body: any, @Res() res: Response) {
    try {
      console.log('Received /documents request with body:', body);
      let payload = this.apiService.getAuthHeaderForReq(body);
      console.log('documents: service parser payload:', payload);
      if (!payload) {
        payload = this.localParseFallback(body, req);
        console.log('documents: used fallback parser, payload:', payload);
      } else {
        console.log('documents: used service parser, payload:', payload);
      }

      if (!payload) {
        console.log('Payload missing or could not be decrypted/parsed for /documents');
        return this.apiService.sendEncryptedResponse(res, { error: 'Invalid payload' }, HttpStatus.BAD_REQUEST);
      }
      const rows = await this.apiService.fetchDocuments(payload);
      return this.apiService.sendEncryptedResponse(res, rows);
    } catch (err) {
      console.log('Error in /documents:', err);
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('document-categories')
  async documentCategories(@Res() res: Response) {
    try {
      const rows = await this.apiService.fetchFromApi('/tpf_document_categories?is_active=eq.true');
      return this.apiService.sendEncryptedResponse(res, rows);
    } catch (err) {
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-mail-nav-update')
  async sendMailNavUpdate(@Body() body: any, @Headers('authorization') authHeader: string, @Res() res: Response) {
    try {
      const token = authHeader?.split(' ')[1];
      const result = await this.apiService.sendMailNavUpdate(body, token);
      return res.status(result.status || 200).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  @Post('contact-us')
  async contactUs(@Req() req: Request, @Body() body: any, @Res() res: Response) {
    try {
      let payload = this.apiService.getAuthHeaderForReq(body);
      if (!payload) {
        payload = this.localParseFallback(body, req);
        console.log('contact-us: used fallback parser, payload:', payload);
      } else {
        console.log('contact-us: used service parser, payload:', payload);
      }
      const result = await this.apiService.contactUs(payload);
      return this.apiService.sendEncryptedResponse(res, result);
    } catch (err) {
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('routes')
  async routes(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.apiService.getRoutes(req);
      // allow plain JSON when explicitly requested
      const rawQuery = (req.query as any)?.raw;
      const headerRaw = (req.header('x-return-plain') || '').toLowerCase();
      const returnPlain =
        process.env.NODE_ENV === 'test' ||
        rawQuery === '1' ||
        rawQuery === 'true' ||
        headerRaw === '1' ||
        headerRaw === 'true';
      if (returnPlain) {
        return res.json(result);
      }
      return this.apiService.sendEncryptedResponse(res, result);
    } catch (err) {
      return this.apiService.sendEncryptedResponse(res, { error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
