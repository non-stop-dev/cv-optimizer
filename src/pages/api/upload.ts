import type { APIRoute } from 'astro';

import {
	GeminiConfigurationError,
	GeminiRequestError,
	gemini
} from '../../server/llm-processing/gemini-service';
import { UploadSanitizationError } from '../../server/llm-processing/upload/errors';
import { sanitizeHtmlDocument } from '../../server/llm-processing/upload/sanitizers/html';
import { sanitizeUploadedDocument } from '../../server/llm-processing/upload/sanitizeUploadedDocument';
import { parseTargetPositionsFromFormData } from '../../server/llm-processing/upload/validators';

export const prerender = false;

type CodingEnvironment = 'development' | 'production';

const resolveCodingEnvironment = (): CodingEnvironment => {
	const rawValue =
		import.meta.env.CODING_ENVIRONMENT?.trim().toLowerCase() ||
		process.env.CODING_ENVIRONMENT?.trim().toLowerCase() ||
		'production';

	if (rawValue === 'development' || rawValue === 'production') {
		return rawValue;
	}

	console.warn(
		`⚠️ CODING_ENVIRONMENT="${rawValue}" no es valido. Se usara "production".`
	);
	return 'production';
};

const CODING_ENVIRONMENT = resolveCodingEnvironment();

const logDevelopment = (title: string, payload: string): void => {
	if (CODING_ENVIRONMENT !== 'development') {
		return;
	}

	console.info(`\n[CV-OPTIMIZER][DEV] ${title}\n${payload}\n`);
};

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
	logDevelopment(
		'Upload endpoint request',
		JSON.stringify(
			{
				method: request.method,
				codingEnvironment: CODING_ENVIRONMENT,
				contentType: request.headers.get('content-type')
			},
			null,
			2
		)
	);

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

	logDevelopment(
		'Document received',
		JSON.stringify(
			{
				fileName: candidate.name,
				sizeInBytes: candidate.size,
				mimeType: candidate.type
			},
			null,
			2
		)
	);

	try {
		const targetPositions = parseTargetPositionsFromFormData(formData.get('targetPositions'));
		logDevelopment(
			'Target positions received',
			JSON.stringify(
				{
					targetPositions,
					count: targetPositions.length
				},
				null,
				2
			)
		);

		const sanitizedDocument = await sanitizeUploadedDocument(candidate, targetPositions);

		logDevelopment(
			'Sanitized document',
			JSON.stringify(
				{
					format: sanitizedDocument.format,
					safeFileName: sanitizedDocument.safeFileName,
					sizeInBytes: sanitizedDocument.sizeInBytes,
					summary: sanitizedDocument.summary,
					contentHash: sanitizedDocument.contentHash
				},
				null,
				2
			)
		);
		logDevelopment('Sanitized content sent to AI', sanitizedDocument.sanitizedContent);

		// Dispara el flujo de optimización con Gemini
		const configuredModels = gemini.getConfiguredModels();
		const optimizedHTML = await gemini.optimizeCV(
			sanitizedDocument.sanitizedContent,
			sanitizedDocument.targetPositions
		);
		const safeOptimizedHTML = sanitizeHtmlDocument(optimizedHTML);

		if (!safeOptimizedHTML.trim()) {
			logDevelopment('AI empty response', 'El HTML optimizado llego vacio tras sanitizacion.');
			return toJsonResponse(
				{
					ok: false,
					error: {
						code: 'AI_EMPTY_RESPONSE',
						message: 'La IA no devolvio contenido util para este documento.'
					}
				},
				502
			);
		}

		return toJsonResponse({
			ok: true,
			message: 'Documento procesado y optimizado con éxito.',
			data: {
				format: sanitizedDocument.format,
				safeFileName: sanitizedDocument.safeFileName,
				sizeInBytes: sanitizedDocument.sizeInBytes,
				summary: sanitizedDocument.summary,
				contentHash: sanitizedDocument.contentHash,
				targetPositions: sanitizedDocument.targetPositions,
				optimizedHTML: safeOptimizedHTML, // Contenido enriquecido por la IA
				models: configuredModels
			}
		});
	} catch (error) {
		logDevelopment(
			'Upload pipeline error',
			error instanceof Error ? `${error.name}: ${error.message}` : 'Error no identificado'
		);

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

		if (error instanceof GeminiConfigurationError) {
			return toJsonResponse(
				{
					ok: false,
					error: {
						code: 'AI_NOT_CONFIGURED',
						message: 'El servicio de optimizacion no esta configurado en este entorno.'
					}
				},
				503
			);
		}

		if (error instanceof GeminiRequestError) {
			const isProviderOverloaded = error.kind === 'provider-overloaded';
			const isQuotaExhausted = error.kind === 'quota-exhausted';
			return toJsonResponse(
				{
					ok: false,
					error: {
						code: isProviderOverloaded
							? 'AI_PROVIDER_OVERLOADED'
							: isQuotaExhausted
								? 'AI_QUOTA_EXHAUSTED'
								: 'AI_PROCESSING_FAILED',
						message: error.message
					}
				},
				isProviderOverloaded ? 503 : isQuotaExhausted ? 429 : 502
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
