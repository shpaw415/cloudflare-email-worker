import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage } from 'mimetext';
import { __EmailWorkerType__ } from './types';
import EmailTemplate from './email-template';
import { renderToStaticMarkup } from 'react-dom/server';

function getCorsOrigin(request: Request, allowedOrigins: string[]): string {
	const origin = request.headers.get('Origin');
	return origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function createResponse(request: Request, body: BodyInit, status: number, allowedOrigins: string[]): Response {
	const corsOrigin = getCorsOrigin(request, allowedOrigins);
	return new Response(body, { status, headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': corsOrigin } });
}

function traceId(request: Request): string {
	return request.headers.get('cf-ray') || crypto.randomUUID();
}

function describeError(error: unknown): { name?: string; code?: string; message: string; stack?: string } {
	if (error instanceof Error) {
		const coded = error as Error & { code?: string };
		return {
			name: coded.name,
			code: coded.code,
			message: coded.message,
			stack: coded.stack,
		};
	}
	return { message: String(error) };
}

function logFailure(step: string, id: string, error: unknown, context: Record<string, unknown>): void {
	const details = describeError(error);
	const message = details.message.replace(/\s+/g, ' ');
	console.error(`mail-worker ${step} failed trace=${id} code=${details.code ?? 'none'} message=${message}`);
	console.error(JSON.stringify({ traceId: id, step, error: details, context }));
}

function foldBase64(value: string): string {
	return value.replace(/.{1,76}/g, '$&\r\n').replace(/\r\n$/, '');
}

function encodeBase64(value: string): string {
	const bytes = new TextEncoder().encode(value.replace(/\r?\n/g, '\r\n'));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return foldBase64(btoa(binary));
}

function hasNonAscii(value: string): boolean {
	return /[^\u0000-\u007f]/.test(value);
}

const OMITTED_PLAIN_TEXT_FIELDS = new Set(['recaptchaToken', 'turnstileToken', 'to_email', 'subject']);

function plainText(data: __EmailWorkerType__): string {
	return Object.entries(data)
		.filter((entry): entry is [string, string] => {
			const [key, value] = entry;
			return !OMITTED_PLAIN_TEXT_FIELDS.has(key) && typeof value === 'string' && value.length > 0;
		})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\r\n');
}

function formHadNonAscii(data: __EmailWorkerType__, subject: string): boolean {
	const values = Object.entries(data)
		.filter(([key, value]) => key !== 'recaptchaToken' && key !== 'turnstileToken' && typeof value === 'string')
		.map(([, value]) => value);
	return hasNonAscii([subject, ...values].join(''));
}

export function createMessage(env: Env, data: __EmailWorkerType__) {
	const EmailTemplateResult = EmailTemplate(data);
	if (EmailTemplateResult instanceof Error) {
		throw new Error(`Email template error: ${EmailTemplateResult.message}`);
	}

	const html = typeof EmailTemplateResult === 'string' ? undefined : renderToStaticMarkup(EmailTemplateResult);
	const text = typeof EmailTemplateResult === 'string' ? EmailTemplateResult : plainText(data);
	const msg = createMimeMessage();
	msg.setSender(env.FROM_EMAIL);
	msg.setRecipient(data.to_email?.trim() || env.TO_EMAIL);
	msg.setSubject(data.subject || 'New Contact Form Submission');
	msg.addMessage({
		contentType: 'text/plain',
		encoding: 'base64',
		data: encodeBase64(text),
	});
	if (html) {
		msg.addMessage({
			contentType: 'text/html',
			encoding: 'base64',
			data: encodeBase64(html),
		});
	}
	return msg;
}

interface RecaptchaAssessmentResponse {
	tokenProperties?: {
		valid: boolean;
		action?: string;
		createTime?: string;
	};
	riskAnalysis?: {
		score: number;
		reasons?: string[];
	};
	event?: {
		token: string;
		siteKey: string;
		expectedAction: string;
	};
	error?: {
		code: number;
		message: string;
	};
}

type VerifyResult = { success: boolean; score?: number; error?: string; detail?: string };

async function verifyRecaptcha(token: string, env: Env): Promise<VerifyResult> {
	const projectId = env?.RECAPTCHA_PROJECT_ID as string | undefined;
	const apiKey = env?.RECAPTCHA_API_KEY as string | undefined;
	const siteKey = env?.RECAPTCHA_SITE_KEY as string | undefined;
	const loggingEnabled = (env?.ENABLE_LOGGING as string) === 'true';

	if (!projectId || !apiKey || !siteKey) {
		return {
			success: false,
			error: 'Configuration reCAPTCHA manquante.',
			detail: 'Missing RECAPTCHA_PROJECT_ID, RECAPTCHA_API_KEY, or RECAPTCHA_SITE_KEY',
		};
	}

	const requestBody = {
		event: {
			token,
			siteKey,
			expectedAction: 'submit_contact_form',
		},
	};

	const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
		});

		const result: RecaptchaAssessmentResponse = await response.json();

		if (!response.ok) {
			return {
				success: false,
				error: 'Erreur de vérification reCAPTCHA.',
				detail: `status=${response.status} message=${result.error?.message ?? 'none'}`,
			};
		}

		const tokenValid = result.tokenProperties?.valid ?? false;
		const actionMatch = result.tokenProperties?.action === 'submit_contact_form';
		const score = result.riskAnalysis?.score ?? 0;

		loggingEnabled && console.log('reCAPTCHA result:', { tokenValid, actionMatch, score });

		if (!tokenValid) {
			return { success: false, score, error: 'Token reCAPTCHA invalide.' };
		}

		if (!actionMatch) {
			return { success: false, score, error: 'Action reCAPTCHA non correspondante.' };
		}

		if (score < 0.5) {
			return { success: false, score, error: 'Score reCAPTCHA trop bas. Veuillez réessayer.' };
		}

		return { success: true, score };
	} catch (error) {
		return { success: false, error: 'Échec de la vérification reCAPTCHA.', detail: describeError(error).message };
	}
}

type TurnStileResponse =
	| {
			success: true;
			challenge_ts: `${string}-${string}-${string}:${string}:${string}.${string}`;
			hostname: string;
			'error-codes': string[];
			action: 'login';
			cdata: `sessionid-${string}`;
			metadata: {
				ephemeral_id: string;
			};
	  }
	| {
			success: false;
			'error-codes': string[];
	  };

async function verifyTurnstile(token: string, env: Env): Promise<VerifyResult> {
	const secretKey = env.TURNSTILE_SECRET_KEY;
	const loggingEnabled = (env.ENABLE_LOGGING as string) === 'true';

	if (!secretKey) {
		return { success: false, error: 'Configuration Turnstile manquante.', detail: 'Missing TURNSTILE_SECRET_KEY' };
	}

	const formData = new URLSearchParams();
	formData.append('secret', secretKey);
	formData.append('response', token);

	try {
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: formData.toString(),
		});

		const result = (await response.json()) as TurnStileResponse;

		loggingEnabled &&
			console.log('Turnstile result:', {
				success: result.success,
				errorCodes: result.success ? [] : result['error-codes'],
			});

		if (!response.ok || !result.success) {
			const codes = result.success ? [] : result['error-codes'];
			return {
				success: false,
				error: 'Vérification Turnstile échouée. Veuillez réessayer.',
				detail: `status=${response.status} codes=${codes.join(',') || 'none'}`,
			};
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: 'Échec de la vérification Turnstile.', detail: describeError(error).message };
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const id = traceId(request);
		const allowedOrigins = env.AUTHORIZED_ORIGINS.split(',')
			.map((origin) => origin.trim())
			.filter(Boolean);
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': getCorsOrigin(request, allowedOrigins),
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		if (request.method !== 'POST') {
			console.error(`mail-worker method rejected trace=${id} method=${request.method}`);
			return createResponse(request, `Méthode non autorisée. Référence ${id}.`, 405, allowedOrigins);
		}

		let data: __EmailWorkerType__;
		try {
			const formData = await request.formData();
			data = Object.fromEntries(formData) as unknown as __EmailWorkerType__;
		} catch (error) {
			logFailure('parse-form', id, error, {
				contentType: request.headers.get('content-type'),
				origin: request.headers.get('origin'),
			});
			return createResponse(request, `Données de formulaire invalides. Référence ${id}.`, 400, allowedOrigins);
		}

		const loggingEnabled = (env.ENABLE_LOGGING as string) === 'true';
		if (loggingEnabled) {
			const { recaptchaToken, turnstileToken, ...safe } = data;
			console.log('Received data:', {
				...safe,
				recaptchaToken: recaptchaToken ? '[redacted]' : undefined,
				turnstileToken: turnstileToken ? '[redacted]' : undefined,
			});
		}

		const createVerifier: () => Response | { enabled: boolean; verify: () => Promise<VerifyResult> } = () => {
			const recaptchaToken = data.recaptchaToken?.trim();
			const recaptchaEnabled = (env.RECAPTCHA_ENABLED as string) === 'true';
			if (recaptchaEnabled && !recaptchaToken) {
				logFailure('missing-token', id, 'Token reCAPTCHA manquant.', { origin: request.headers.get('origin') });
				return createResponse(request, `Token reCAPTCHA manquant. Référence ${id}.`, 400, allowedOrigins);
			} else if (recaptchaEnabled)
				return {
					enabled: true,
					verify: () => verifyRecaptcha(recaptchaToken!, env),
				};

			const turnstileToken = data.turnstileToken?.trim();
			const turnstileEnabled = (env.ENABLE_TURNSTILE as string) === 'true';
			if (turnstileEnabled && !turnstileToken) {
				logFailure('missing-token', id, 'Token Turnstile manquant.', { origin: request.headers.get('origin') });
				return createResponse(request, `Token Turnstile manquant. Référence ${id}.`, 400, allowedOrigins);
			} else if (turnstileEnabled)
				return {
					enabled: true,
					verify: () => verifyTurnstile(turnstileToken!, env),
				};

			return { enabled: false, verify: () => Promise.resolve({ success: true }) };
		};

		const to = data.to_email?.trim() || env.TO_EMAIL;
		const subject = data.subject || 'New Contact Form Submission';
		try {
			const tokenVerifier = createVerifier();
			if (tokenVerifier instanceof Response) {
				return tokenVerifier;
			}
			const verifyResult = await tokenVerifier.verify();
			if (verifyResult && !verifyResult.success) {
				logFailure('verify', id, verifyResult.detail || verifyResult.error || 'unknown', {
					origin: request.headers.get('origin'),
				});
				return createResponse(request, `${verifyResult.error ?? 'Vérification échouée.'} Référence ${id}.`, 403, allowedOrigins);
			}
			const raw_message = createMessage(env, data).asRaw();
			loggingEnabled && console.log(raw_message);
			const email_message = new EmailMessage(env.FROM_EMAIL, to, raw_message);
			await env.EMAIL.send(email_message);
			console.log(`mail-worker sent trace=${id} to=${to} bytes=${raw_message.length}`);
			return createResponse(request, 'Email envoyé avec succès !', 200, allowedOrigins);
		} catch (error) {
			const details = describeError(error);
			logFailure('send', id, error, {
				from: env.FROM_EMAIL,
				to,
				subject,
				origin: request.headers.get('origin'),
				messageLength: data.message?.length ?? 0,
				nonAscii: formHadNonAscii(data, subject),
			});
			const code = details.code ? ` (${details.code})` : '';
			return createResponse(request, `Erreur lors de l'envoi de l'email${code}. Référence ${id}.`, 500, allowedOrigins);
		}
	},
} satisfies ExportedHandler<Env>;
