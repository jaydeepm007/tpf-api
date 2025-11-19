import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MailerService {
	constructor() {}

	private createTransport() {
		return nodemailer.createTransport({
			host: 'smtp.office365.com',
			port: 587,
			secure: false, // STARTTLS
			auth: {
				user: process.env.EMAIL,
				pass: process.env.EMAIL_PASSWORD,
			},
			tls: {
				ciphers: 'TLSv1.2',
			},
		});
	}

	/**
	 * Send email using a template under src/mailer/templates/<template>.html
	 * options:
	 *  - to (string|string[])
	 *  - cc?
	 *  - bcc?
	 *  - subject? (defaults to "NAV Upload Status- NPS")
	 *  - template? (defaults to "nav")
	 *  - context? ({ DataTable: string, DATE: string, ... })
	 */
	async sendMail(options: {
		to: string | string[];
		cc?: string | string[];
		bcc?: string | string[];
		subject?: string;
		template?: string;
		context?: Record<string, any>;
	}) {
		const transporter = this.createTransport();
		const templateName = options.template || 'nav';
		const templatePath = join(__dirname, 'templates', `${templateName}.html`);

		let html = '';
		try {
			html = readFileSync(templatePath, 'utf8');
		} catch (err) {
			// If template not found, fallback to empty body or context.body
			html = options.context?.body || '';
		}

		// Simple placeholder replacement: {{DataTable}} and {{DATE}}
		const ctx = options.context || {};
		html = html.replace(/{{\s*DataTable\s*}}/g, ctx.DataTable ?? '');
		html = html.replace(/{{\s*DATE\s*}}/g, ctx.DATE ?? '');
        html = html.replace(/{{\s*NAME\s*}}/g, ctx.NAME ?? '');
        html = html.replace(/{{\s*EMAIL\s*}}/g, ctx.EMAIL ?? '');
        html = html.replace(/{{\s*PHONE\s*}}/g, ctx.PHONE ?? '');
        html = html.replace(/{{\s*MESSAGE\s*}}/g, ctx.MESSAGE ?? '');

		const mailOptions = {
			from: process.env.EMAIL,
			to: options.to,
			cc: options.cc ?? '',
			bcc: options.bcc ?? '',
			subject: options.subject ?? 'NAV Upload Status- NPS',
			html,
		};

		const info = await transporter.sendMail(mailOptions);
		return info;
	}
}
