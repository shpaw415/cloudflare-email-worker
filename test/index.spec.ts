import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { createMessage } from '../src/index';
import type { __EmailWorkerType__ } from '../src/types';

type Incoming = Parameters<typeof worker.fetch>[0];

function incoming(request: Request): Incoming {
	return request as Incoming;
}

function testEnv(overrides: Partial<Env> = {}): Env {
	return {
		FROM_EMAIL: 'no-reply@example.com',
		TO_EMAIL: 'inbox@example.com',
		AUTHORIZED_ORIGINS: 'https://example.com',
		RECAPTCHA_ENABLED: 'false',
		ENABLE_TURNSTILE: 'false',
		ENABLE_LOGGING: 'false',
		RECAPTCHA_PROJECT_ID: '',
		RECAPTCHA_API_KEY: '',
		RECAPTCHA_SITE_KEY: '',
		TURNSTILE_SITE_KEY: '',
		TURNSTILE_SECRET_KEY: 'test-secret',
		EMAIL: {
			send: async () => ({ messageId: 'ok' }),
		},
		...overrides,
	} as Env;
}

function decodeBase64Parts(raw: string): string[] {
	return raw.split(/Content-Transfer-Encoding: base64\r?\n\r?\n/).slice(1).map((chunk) => {
		const body = chunk.split(/\r?\n--/)[0].replace(/\s/g, '');
		const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	});
}

describe('UTF-8 contact email', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('base64-encodes text and html so the MIME body has no raw non-ASCII', () => {
		const raw = createMessage(testEnv(), {
			message: 'Café à Montréal — déjà',
			subject: 'Déjà —',
			name: 'Élise',
		} as __EmailWorkerType__).asRaw();

		expect(raw).toContain('Content-Type: text/plain; charset=UTF-8');
		expect(raw).toContain('Content-Type: text/html; charset=UTF-8');
		const ctes = [...raw.matchAll(/Content-Transfer-Encoding: (\S+)/g)].map((match) => match[1]);
		expect(ctes.length).toBeGreaterThan(0);
		expect(ctes.every((cte) => cte === 'base64')).toBe(true);
		expect(raw).not.toMatch(/[^\u0000-\u007f]/);

		const decoded = decodeBase64Parts(raw).join('\n');
		expect(decoded).toContain('Café à Montréal — déjà');
		expect(decoded).toContain('Élise');
		expect(decoded).toContain('—');
	});

	it('logs one searchable send-failure line and returns that trace', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const sendError = Object.assign(new Error('invalid encoding'), { code: 'E_MIME' });
		const request = new Request('https://example.com/', {
			method: 'POST',
			headers: {
				'cf-ray': 'trace123-YYZ',
				'content-type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				message: 'Café à —',
				subject: 'Bonjour',
				turnstileToken: 'secret-token-value',
			}),
		});
		const response = await worker.fetch(
			incoming(request),
			testEnv({
				EMAIL: {
					send: async () => {
						throw sendError;
					},
				},
			}),
		);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe("Erreur lors de l'envoi de l'email (E_MIME). Référence trace123-YYZ.");

		const lines = errorSpy.mock.calls.map((call) => call.map((part) => String(part)).join(' '));
		expect(lines).toContain('mail-worker send failed trace=trace123-YYZ code=E_MIME message=invalid encoding');
		expect(lines.join('\n')).not.toContain('secret-token-value');
		for (const call of errorSpy.mock.calls) {
			expect(call[0]).not.toBeInstanceOf(Error);
			expect(String(call[0])).not.toMatch(/\n\s+at /);
		}

		const parsed = JSON.parse(lines.find((line) => line.startsWith('{')) ?? '');
		expect(parsed).toMatchObject({
			traceId: 'trace123-YYZ',
			step: 'send',
			error: { code: 'E_MIME', message: 'invalid encoding' },
			context: { nonAscii: true, from: 'no-reply@example.com', to: 'inbox@example.com', subject: 'Bonjour' },
		});
	});

	it('logs a missing Turnstile token with the same trace returned to the client', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const request = new Request('https://example.com/', {
			method: 'POST',
			headers: { 'cf-ray': 'missing-token-YYZ', 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ message: 'hello' }),
		});
		const response = await worker.fetch(incoming(request), testEnv({ ENABLE_TURNSTILE: 'true' }));

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Token Turnstile manquant. Référence missing-token-YYZ.');
		const lines = errorSpy.mock.calls.map((call) => String(call[0]));
		expect(lines).toContain('mail-worker missing-token failed trace=missing-token-YYZ code=none message=Token Turnstile manquant.');
	});
});
