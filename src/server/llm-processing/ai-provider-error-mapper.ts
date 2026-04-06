import OpenAI from 'openai';
import { AiProviderRequestError } from './ai-provider-errors';
import type { SupportedAiProvider } from './ai-provider-types';

interface GeminiNativeApiErrorInfo {
	status?: number;
	apiStatus?: string;
	reason?: string;
	message?: string;
	activationUrl?: string;
}

const providerLabelMap: Record<SupportedAiProvider, string> = {
	openai: 'OpenAI',
	gemini: 'Gemini',
	openrouter: 'OpenRouter'
};

const toProviderLabel = (provider: SupportedAiProvider): string => {
	return providerLabelMap[provider];
};

const isLikelyUnsupportedModelError = (status: number | undefined, message: string | undefined): boolean => {
	if (status !== 400 && status !== 404 && status !== 422) {
		return false;
	}

	const normalizedMessage = (message ?? '').toLowerCase();
	return (
		normalizedMessage.includes('model') &&
		(normalizedMessage.includes('not found') ||
			normalizedMessage.includes('unsupported') ||
			normalizedMessage.includes('does not exist') ||
			normalizedMessage.includes('invalid'))
	);
};

/**
 * Maps OpenAI SDK errors from OpenAI, Gemini OpenAI-compatible, and OpenRouter calls.
 */
export const mapOpenAiCompatibleError = (
	provider: SupportedAiProvider,
	error: unknown,
	fallbackMessage: string
): never => {
	const providerLabel = toProviderLabel(provider);

	if (error instanceof OpenAI.APIConnectionError) {
		throw new AiProviderRequestError(
			`No se pudo conectar con ${providerLabel}. Revisa red, base URL y disponibilidad del proveedor.`,
			error
		);
	}

	if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
		throw new AiProviderRequestError(
			`La API key o permisos de ${providerLabel} no son validos para este entorno.`,
			error
		);
	}

	if (error instanceof OpenAI.RateLimitError) {
		throw new AiProviderRequestError(
			error.message?.trim() ||
				`Se excedio la cuota o el rate limit de ${providerLabel}. Revisa billing y limites de uso.`,
			error,
			'quota-exhausted'
		);
	}

	if (error instanceof OpenAI.InternalServerError) {
		throw new AiProviderRequestError(
			error.message?.trim() ||
				`${providerLabel} esta saturado temporalmente. Intenta de nuevo en unos minutos.`,
			error,
			'provider-overloaded'
		);
	}

	if (error instanceof OpenAI.APIError) {
		if (error.status === 402 || error.status === 429) {
			throw new AiProviderRequestError(
				error.message?.trim() ||
					`Se excedio la cuota o el rate limit de ${providerLabel}. Revisa billing y limites de uso.`,
				error,
				'quota-exhausted'
			);
		}

		if (error.status === 503) {
			throw new AiProviderRequestError(
				error.message?.trim() ||
					`${providerLabel} esta saturado temporalmente. Intenta de nuevo en unos minutos.`,
				error,
				'provider-overloaded'
			);
		}

		if (isLikelyUnsupportedModelError(error.status, error.message)) {
			throw new AiProviderRequestError(
				`El modelo configurado no existe o no es compatible con ${providerLabel}. Revisa AI_PROVIDER_MODEL.`,
				error,
				'unsupported-model'
			);
		}

		throw new AiProviderRequestError(error.message?.trim() || fallbackMessage, error);
	}

	console.error(`❌ Error llamando a ${providerLabel}:`, error);
	throw new AiProviderRequestError(fallbackMessage, error);
};

const extractGeminiNativeApiErrorInfo = (error: unknown): GeminiNativeApiErrorInfo => {
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
				status?: string;
				message?: string;
				details?: Array<{ reason?: string; metadata?: { activationUrl?: string } }>;
			};
		};
		const detailWithReason = parsed.error?.details?.find(
			(detail) => typeof detail.reason === 'string'
		);

		return {
			status,
			apiStatus: parsed.error?.status,
			reason: detailWithReason?.reason,
			message: parsed.error?.message,
			activationUrl: detailWithReason?.metadata?.activationUrl
		};
	} catch {
		return { status };
	}
};

/**
 * Maps raw Gemini Files API errors from the native PDF branch into provider-neutral errors.
 */
export const mapGeminiNativePdfError = (error: unknown): never => {
	const apiErrorInfo = extractGeminiNativeApiErrorInfo(error);
	if (apiErrorInfo.status === 403 && apiErrorInfo.reason === 'SERVICE_DISABLED') {
		const activationHint = apiErrorInfo.activationUrl
			? ` Activa la API en: ${apiErrorInfo.activationUrl}`
			: '';
		throw new AiProviderRequestError(
			`La API de Gemini no esta habilitada para esta API key.${activationHint}`,
			error
		);
	}

	if (apiErrorInfo.status === 403) {
		throw new AiProviderRequestError(
			'La API key no tiene permisos para usar Gemini desde este entorno/proyecto.',
			error
		);
	}

	if (apiErrorInfo.status === 503 || apiErrorInfo.apiStatus === 'UNAVAILABLE') {
		throw new AiProviderRequestError(
			apiErrorInfo.message?.trim() ||
				'El proveedor Gemini esta saturado temporalmente. Intenta de nuevo en unos minutos.',
			error,
			'provider-overloaded'
		);
	}

	if (apiErrorInfo.status === 429 || apiErrorInfo.apiStatus === 'RESOURCE_EXHAUSTED') {
		throw new AiProviderRequestError(
			apiErrorInfo.message?.trim() ||
				'Se excedio la cuota del proveedor Gemini. Revisa plan, billing y limites de uso.',
			error,
			'quota-exhausted'
		);
	}

	console.error('❌ Error llamando al flujo PDF nativo de Gemini:', error);
	throw new AiProviderRequestError('No se pudo procesar el CV con la IA.', error);
};
