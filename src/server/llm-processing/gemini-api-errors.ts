import { GeminiRequestError } from './gemini-errors';

interface ApiErrorInfo {
	status?: number;
	apiStatus?: string;
	apiCode?: number;
	reason?: string;
	message?: string;
	activationUrl?: string;
}

const extractApiErrorInfo = (error: unknown): ApiErrorInfo => {
	if (!error || typeof error !== 'object') {
		return {};
	}

	const errorLike = error as { status?: unknown; message?: unknown };
	const status = typeof errorLike.status === 'number' ? errorLike.status : undefined;
	const rawMessage = typeof errorLike.message === 'string' ? errorLike.message : undefined;

	if (!rawMessage) {
		return { status };
	}

	try {
		const parsed = JSON.parse(rawMessage) as {
			error?: {
				code?: number;
				status?: string;
				message?: string;
				details?: Array<{ reason?: string; metadata?: { activationUrl?: string } }>;
			};
		};
		const details = Array.isArray(parsed.error?.details) ? parsed.error.details : [];
		const errorInfo = details.find((detail) => typeof detail.reason === 'string');
		return {
			status,
			apiCode: parsed.error?.code,
			apiStatus: parsed.error?.status,
			reason: errorInfo?.reason,
			message: parsed.error?.message,
			activationUrl: errorInfo?.metadata?.activationUrl
		};
	} catch {
		return { status };
	}
};

export const mapGeminiUnknownError = (error: unknown): never => {
	const apiErrorInfo = extractApiErrorInfo(error);
	if (apiErrorInfo.status === 403 && apiErrorInfo.reason === 'SERVICE_DISABLED') {
		const activationHint = apiErrorInfo.activationUrl
			? ` Activa la API en: ${apiErrorInfo.activationUrl}`
			: '';
		throw new GeminiRequestError(
			`La API de Gemini no esta habilitada en el proyecto de GCP de esta API key.${activationHint}`,
			error
		);
	}

	if (apiErrorInfo.status === 403) {
		throw new GeminiRequestError(
			'La API key no tiene permisos para usar Gemini desde este entorno/proyecto.',
			error
		);
	}

	if (apiErrorInfo.status === 503 || apiErrorInfo.apiStatus === 'UNAVAILABLE') {
		throw new GeminiRequestError(
			apiErrorInfo.message?.trim() ||
				'El modelo de IA esta saturado temporalmente. Intenta de nuevo en unos minutos.',
			error,
			'provider-overloaded'
		);
	}

	if (apiErrorInfo.status === 429 || apiErrorInfo.apiStatus === 'RESOURCE_EXHAUSTED') {
		throw new GeminiRequestError(
			apiErrorInfo.message?.trim() ||
				'Se excedio la cuota del proveedor de IA. Revisa plan, billing y limites de uso.',
			error,
			'quota-exhausted'
		);
	}

	console.error('❌ Error llamando a Gemini:', error);
	throw new GeminiRequestError('No se pudo procesar el CV con la IA.', error);
};
