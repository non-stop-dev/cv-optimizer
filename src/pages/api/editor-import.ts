import type { APIRoute } from 'astro';

import { importDocumentToEditor } from '../../server/editor-import/editor-import-document';
import { UploadSanitizationError } from '../../server/llm-processing/upload/errors';

export const prerender = false;

const toJsonResponse = (payload: unknown, statusCode = 200): Response => {
	return new Response(JSON.stringify(payload), {
		status: statusCode,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};

export const POST: APIRoute = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('multipart/form-data')) {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Usa multipart/form-data para importar un documento al editor.'
				}
			},
			415
		);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'No se pudo leer el formulario enviado.'
				}
			},
			400
		);
	}

	const candidate = formData.get('document');
	if (!(candidate instanceof File)) {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'MISSING_FILE',
					message: 'Debes enviar un archivo en el campo document.'
				}
			},
			400
		);
	}

	try {
		const importResult = await importDocumentToEditor(candidate);

		return toJsonResponse({
			ok: true,
			message: 'Documento importado al editor con exito.',
			data: {
				...importResult
			}
		});
	} catch (error) {
		if (error instanceof UploadSanitizationError) {
			return toJsonResponse(
				{
					ok: false,
					error: {
						code: error.code,
						message: error.message
					}
				},
				error.statusCode
			);
		}

		console.error('Editor import failed unexpectedly.', error);

		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'EDITOR_IMPORT_FAILED',
					message: 'No se pudo preparar el documento para abrirlo en el editor.'
				}
			},
			500
		);
	}
};
