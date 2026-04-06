import type { APIRoute } from 'astro';

import {
	AiProviderConfigurationError,
	AiProviderRequestError,
	aiProvider
} from '../../server/llm-processing/ai-provider-service';
import { UploadSanitizationError } from '../../server/llm-processing/upload/errors';
import { sanitizeHtmlDocument } from '../../server/llm-processing/upload/sanitizers/html';

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

	console.warn(`⚠️ CODING_ENVIRONMENT="${rawValue}" no es valido. Se usara "production".`);
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

interface TranslationRequestBody {
	optimizedHTML?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
	logDevelopment(
		'Translate endpoint request',
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
	if (!contentType.includes('application/json')) {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Usa application/json para solicitar traduccion.'
				}
			},
			415
		);
	}

	let body: TranslationRequestBody;
	try {
		body = (await request.json()) as TranslationRequestBody;
	} catch {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'No se pudo leer el payload JSON.'
				}
			},
			400
		);
	}

	if (typeof body.optimizedHTML !== 'string') {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Debes enviar optimizedHTML como string.'
				}
			},
			400
		);
	}

	let safeInputHtml = '';
	try {
		safeInputHtml = sanitizeHtmlDocument(body.optimizedHTML);
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
					message: 'No se pudo sanitizar el contenido para traduccion.'
				}
			},
			400
		);
	}

	if (!safeInputHtml.trim()) {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'EMPTY_CONTENT',
					message: 'No hay contenido valido para traducir.'
				}
			},
			422
		);
	}

	try {
		const translatedHtml = await aiProvider.translateCvToEnglish(safeInputHtml);
		let safeTranslatedHtml = '';
		try {
			safeTranslatedHtml = sanitizeHtmlDocument(translatedHtml);
		} catch (error) {
			if (error instanceof UploadSanitizationError) {
				return toJsonResponse(
					{
						ok: false,
						error: {
							code: 'AI_EMPTY_RESPONSE',
							message: 'La traduccion devolvio contenido HTML invalido.'
						}
					},
					502
				);
			}

			throw error;
		}

		if (!safeTranslatedHtml.trim()) {
			return toJsonResponse(
				{
					ok: false,
					error: {
						code: 'AI_EMPTY_RESPONSE',
						message: 'La traduccion no devolvio contenido util.'
					}
				},
				502
			);
		}

		return toJsonResponse({
			ok: true,
			message: 'CV traducido al ingles con exito.',
			data: {
				translatedHTML: safeTranslatedHtml,
				models: aiProvider.getConfiguredModels()
			}
		});
	} catch (error) {
		logDevelopment(
			'Translate pipeline error',
			error instanceof Error ? `${error.name}: ${error.message}` : 'Error no identificado'
		);

		if (error instanceof AiProviderConfigurationError) {
			return toJsonResponse(
				{
					ok: false,
					error: {
						code: 'AI_NOT_CONFIGURED',
						message: 'El servicio de traduccion no esta configurado en este entorno.'
					}
				},
				503
			);
		}

		if (error instanceof AiProviderRequestError) {
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
								: 'AI_TRANSLATION_FAILED',
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
					message: 'Ocurrio un error interno al traducir el CV.'
				}
			},
			500
		);
	}
};
