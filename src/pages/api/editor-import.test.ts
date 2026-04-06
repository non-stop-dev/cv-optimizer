import { beforeEach, describe, expect, it, vi } from 'vitest';

const { importDocumentToEditorMock } = vi.hoisted(() => ({
	importDocumentToEditorMock: vi.fn()
}));

vi.mock('../../server/editor-import/editor-import-document', () => ({
	importDocumentToEditor: importDocumentToEditorMock
}));

import { UploadSanitizationError } from '../../server/llm-processing/upload/errors';
import { POST } from './editor-import';

const callPost = async (request: Request): Promise<Response> => {
	return POST({ request } as Parameters<typeof POST>[0]);
};

beforeEach(() => {
	importDocumentToEditorMock.mockReset();
});

describe('editor-import API', () => {
	it('mantiene la forma del payload para importacion HTML directa', async () => {
		importDocumentToEditorMock.mockResolvedValue({
			format: 'html',
			safeFileName: 'cv.html',
			sizeInBytes: 128,
			summary: 'HTML sanitizado y cargado directamente en el editor.',
			contentHash: 'hash-123',
			optimizedHTML: '<section><h1>Ana</h1></section>',
			importMode: 'html-direct',
			importNotice: 'El HTML se cargo directamente en el editor sin pasar por la IA.'
		});

		const formData = new FormData();
		formData.append('document', new File(['<h1>Ana</h1>'], 'cv.html', { type: 'text/html' }));

		const response = await callPost(
			new Request('http://localhost/api/editor-import', {
				method: 'POST',
				body: formData
			})
		);
		const payload = (await response.json()) as {
			ok: boolean;
			data: {
				importMode: string;
				optimizedHTML: string;
				importNotice: string;
			};
		};

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.data.importMode).toBe('html-direct');
		expect(payload.data.optimizedHTML).toBe('<section><h1>Ana</h1></section>');
		expect(payload.data.importNotice).toContain('sin pasar por la IA');
	});

	it('propaga errores de validacion como respuesta controlada', async () => {
		importDocumentToEditorMock.mockRejectedValue(
			new UploadSanitizationError({
				code: 'UNSUPPORTED_EXTENSION',
				statusCode: 415,
				message: 'La carga directa al editor solo acepta archivos PDF o HTML.'
			})
		);

		const formData = new FormData();
		formData.append('document', new File(['texto'], 'cv.txt', { type: 'text/plain' }));

		const response = await callPost(
			new Request('http://localhost/api/editor-import', {
				method: 'POST',
				body: formData
			})
		);
		const payload = (await response.json()) as {
			ok: false;
			error: {
				code: string;
				message: string;
			};
		};

		expect(response.status).toBe(415);
		expect(payload.error.code).toBe('UNSUPPORTED_EXTENSION');
		expect(payload.error.message).toContain('PDF o HTML');
	});
});
