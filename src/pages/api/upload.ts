import type { APIRoute } from 'astro';

import { UploadSanitizationError } from '../../server/llm-processing/upload/errors';
import { sanitizeUploadedDocument } from '../../server/llm-processing/upload/sanitizeUploadedDocument';

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
					message: 'Usa multipart/form-data para subir documentos.'
				}
			},
			415
		);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch (error) {
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
		const sanitizedDocument = await sanitizeUploadedDocument(candidate);
		return toJsonResponse({
			ok: true,
			message: 'Documento validado y sanitizado correctamente.',
			data: {
				format: sanitizedDocument.format,
				safeFileName: sanitizedDocument.safeFileName,
				sizeInBytes: sanitizedDocument.sizeInBytes,
				summary: sanitizedDocument.summary,
				contentHash: sanitizedDocument.contentHash
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

		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Ocurrio un error interno al procesar el documento.'
				}
			},
			500
		);
	}
};
