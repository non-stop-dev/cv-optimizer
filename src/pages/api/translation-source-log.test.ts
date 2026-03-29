import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './translation-source-log';

const callPost = async (request: Request): Promise<Response> => {
	return POST({ request } as Parameters<typeof POST>[0]);
};

describe('translation-source-log API', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registra en terminal la fuente browser-api', async () => {
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const response = await callPost(
			new Request('http://localhost/api/translation-source-log', {
				method: 'POST',
				headers: {
					'content-type': 'application/json; charset=utf-8'
				},
				body: JSON.stringify({
					source: 'browser-api',
					entryId: 'entry-123'
				})
			})
		);

		expect(response.status).toBe(200);
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining('Fuente de traduccion usada: api de traduccion del navegador')
		);
		expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('entryId=entry-123'));
	});

	it('rechaza source invalido', async () => {
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const response = await callPost(
			new Request('http://localhost/api/translation-source-log', {
				method: 'POST',
				headers: {
					'content-type': 'application/json; charset=utf-8'
				},
				body: JSON.stringify({
					source: 'invalid-source'
				})
			})
		);

		expect(response.status).toBe(400);
		expect(infoSpy).not.toHaveBeenCalled();
	});
});
