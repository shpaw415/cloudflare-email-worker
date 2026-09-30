import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'cloudflare:email': fileURLToPath(new URL('./test/cloudflare-email.ts', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
	},
});
