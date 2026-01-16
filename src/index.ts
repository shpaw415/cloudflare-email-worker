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

function createMessage(env: Env, data: __EmailWorkerType__) {
	const EmailTemplateResult = EmailTemplate(data);
	if (EmailTemplateResult instanceof Error) {
		throw new Error(`Email template error: ${EmailTemplateResult.message}`);
	}

	const msg = createMimeMessage();
	msg.setSender(env.FROM_EMAIL);
	msg.setRecipient(data.to_email?.trim() || env.TO_EMAIL);
	msg.setSubject(data.subject || 'New Contact Form Submission');
	if (typeof EmailTemplateResult === 'string') {
		msg.addMessage({
			contentType: 'text/plain',
			data: EmailTemplateResult.split('\n').join('\r\n'),
		});
	} else {
		msg.addMessage({
			contentType: 'text/html',
			data: renderToStaticMarkup(EmailTemplateResult).split('\n').join('\r\n'),
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

async function verifyRecaptcha(token: string, env: Env): Promise<{ success: boolean; score?: number; error?: string }> {
	const projectId = env.RECAPTCHA_PROJECT_ID;
	const apiKey = env.RECAPTCHA_API_KEY;
	const loggingEnabled = (env.ENABLE_LOGGING as string) === 'true';

	if (!projectId || !apiKey) {
		console.error('Missing RECAPTCHA_PROJECT_ID or RECAPTCHA_API_KEY');
		return { success: false, error: 'Configuration reCAPTCHA manquante.' };
	}

	const requestBody = {
		event: {
			token,
			expectedAction: 'submit_contact_form',
			siteKey: '6LdbmUosAAAAACEPvIpUArOl3QTbjboDsJLWqxso',
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
			console.error('reCAPTCHA API error:', result);
			return { success: false, error: 'Erreur de vérification reCAPTCHA.' };
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

		// Score threshold: 0.5 is a reasonable default (0.0 = bot, 1.0 = human)
		if (score < 0.5) {
			return { success: false, score, error: 'Score reCAPTCHA trop bas. Veuillez réessayer.' };
		}

		return { success: true, score };
	} catch (error) {
		console.error('reCAPTCHA verification failed:', error);
		return { success: false, error: 'Échec de la vérification reCAPTCHA.' };
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const allowedOrigins = env.AUTHORIZED_ORIGINS.split(',').map((origin) => origin.trim());
		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': getCorsOrigin(request, allowedOrigins),
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		// Only allow POST requests
		if (request.method !== 'POST') {
			return createResponse(request, 'Méthode non autorisée.', 405, allowedOrigins);
		}

		let data: __EmailWorkerType__;
		try {
			const formData = await request.formData();
			data = Object.fromEntries(formData) as unknown as __EmailWorkerType__;
		} catch {
			return createResponse(request, 'Données de formulaire invalides.', 400, allowedOrigins);
		}

		const recaptchaToken = data.recaptchaToken?.trim();
		const recaptchaEnabled = (env.RECAPTCHA_ENABLED as string) === 'true';
		const loggingEnabled = (env.ENABLE_LOGGING as string) === 'true';

		loggingEnabled && console.log('Received data:', data);

		// Verify reCAPTCHA first
		if (recaptchaEnabled && !recaptchaToken) {
			return createResponse(request, 'Token reCAPTCHA manquant.', 400, allowedOrigins);
		}

		try {
			const recaptchaResult = recaptchaEnabled ? await verifyRecaptcha(recaptchaToken as string, env) : null;
			if (recaptchaResult && !recaptchaResult.success) {
				return createResponse(request, recaptchaResult.error || 'Vérification reCAPTCHA échouée.', 403, allowedOrigins);
			}
			const raw_message = createMessage(env, data).asRaw();
			loggingEnabled && console.log(raw_message);
			const email_message = new EmailMessage(env.FROM_EMAIL, data.to_email || env.TO_EMAIL, raw_message);
			await env.EMAIL.send(email_message);
			return createResponse(request, 'Email envoyé avec succès !', 200, allowedOrigins);
		} catch (error) {
			console.error(error);
			return createResponse(request, `Erreur lors de l'envoi de l'email: ${error}`, 500, allowedOrigins);
		}
	},
} satisfies ExportedHandler<Env>;
