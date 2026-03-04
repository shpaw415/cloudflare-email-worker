import type { FrameMasterConfig } from 'frame-master/server/types';
import { mockData } from './mock';
import { renderToString } from 'react-dom/server';
import { builder } from 'frame-master/build';
import { join } from 'path';
import envToHtml from 'frame-master-plugin-env-in-html';

const wsList: Bun.ServerWebSocket<undefined>[] = [];

export default {
	HTTPServer: {
		port: process.env.PORT,
		routes: {
			'/ws': (req, r) => {
				const res = r.upgrade(req);
				if (!res) return new Response('WebSocket upgrade failed', { status: 400 });
				return new Response('ok', { status: 101 });
			},
			'/': () =>
				new Response(Bun.file(join(process.cwd(), '.frame-master/build/email-template.html')).stream(), {
					headers: {
						'Content-Type': 'text/html',
						'Cache-Control': 'no-cache',
						Pragma: 'no-cache',
						Expires: '0',
					},
				}),
		},
	},
	pluginsOptions: {
		entrypoints: ['../../src/email-template.tsx'],
	},
	plugins: [
		envToHtml({
			entries: ['NODE_ENV', 'PORT'],
		}),
		{
			name: 'react-to-html',
			version: '0.1.0',
			build: {
				buildConfig: {
					splitting: false,
					target: 'browser',
					plugins: [
						{
							name: 'react-to-html',
							setup(build) {
								build.onLoad({ filter: /\email-template.tsx?$/ }, async (args) => {
									const emailTemplate = await import(args.path + `?ts=${Date.now()}`)
										.then((module) => module.default)
										.then((EmailTemplate) => {
											return EmailTemplate(mockData);
										})
										.then(renderToString);

									return {
										contents: emailTemplate,
										loader: 'html',
									};
								});
								build.finally('html', (props) => {
									const rewriter = new HTMLRewriter().on('head', {
										element(element) {
											element.append(`<script src="/hmr.ts"></script>`, { html: true });
										},
									});
									return {
										contents: `
										<!DOCTYPE html>
										${rewriter.transform(props.contents as string)}
										`,
									};
								});
							},
						},
					],
				},
				afterBuild() {
					console.log('Build completed, notifying clients to reload...');
					wsList.forEach((ws) => {
						ws.send('reload');
					});
				},
			},
			websocket: {
				onOpen(ws) {
					wsList.push(ws);
				},
				onClose(ws) {
					const index = wsList.indexOf(ws);
					if (index !== -1) {
						wsList.splice(index, 1);
					}
				},
			},
			router: {
				async request(master) {
					const file = Bun.file(join(process.cwd(), '.frame-master/build', master.URL.pathname));

					if (!(await file.exists())) return;
					master.setResponse(file.stream(), {
						headers: {
							'Content-Type': 'application/javascript',
							'Cache-Control': 'no-cache',
							Pragma: 'no-cache',
							Expires: '0',
						},
					});
				},
			},
			fileSystemWatchDir: ['../../src'],
			async onFileSystemChange() {
				if (!builder?.isBuilding()) await builder?.build();
			},
			serverStart: {
				dev_main() {
					return builder?.build();
				},
			},
		},
	],
} satisfies FrameMasterConfig;
