import type { APIRoute } from 'astro';

export const prerender = false;

type CodingEnvironment = 'development' | 'production';
type TranslationSource = 'browser-api' | 'llm-remote';

interface TranslationSourceLogRequestBody {
	source?: unknown;
	entryId?: unknown;
}

const resolveCodingEnvironment = (): CodingEnvironment => {
	const rawValue =
		import.meta.env.CODING_ENVIRONMENT?.trim().toLowerCase() ||
		process.env.CODING_ENVIRONMENT?.trim().toLowerCase() ||
		'production';

	if (rawValue === 'development' || rawValue === 'production') {
		return rawValue;
	}

	return 'production';
};

const CODING_ENVIRONMENT = resolveCodingEnvironment();

const toJsonResponse = (payload: unknown, statusCode = 200): Response => {
	return new Response(JSON.stringify(payload), {
		status: statusCode,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};

const isTranslationSource = (value: unknown): value is TranslationSource => {
	return value === 'browser-api' || value === 'llm-remote';
};

const toSourceDescription = (source: TranslationSource): string => {
	return source === 'browser-api' ? 'api de traduccion del navegador' : 'modelo LLM remoto';
};

const toSafeEntryId = (value: unknown): string => {
	if (typeof value !== 'string') {
		return 'desconocido';
	}

	const normalized = value.trim();
	if (!normalized) {
		return 'desconocido';
	}

	return normalized;
};

export const POST: APIRoute = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Usa application/json para registrar la fuente de traduccion.'
				}
			},
			415
		);
	}

	let body: TranslationSourceLogRequestBody;
	try {
		body = (await request.json()) as TranslationSourceLogRequestBody;
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

	if (!isTranslationSource(body.source)) {
		return toJsonResponse(
			{
				ok: false,
				error: {
					code: 'INVALID_REQUEST',
					message: 'Debes enviar source como "browser-api" o "llm-remote".'
				}
			},
			400
		);
	}

	const sourceDescription = toSourceDescription(body.source);
	const safeEntryId = toSafeEntryId(body.entryId);
	console.info(
		`[cv-optimizer][${CODING_ENVIRONMENT}] Fuente de traduccion usada: ${sourceDescription}. entryId=${safeEntryId}.`
	);

	return toJsonResponse({ ok: true });
};
