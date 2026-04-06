import { AiProviderConfigurationError } from './ai-provider-errors';
import type {
	AiConfiguredModels,
	AiProviderRuntimeConfig,
	CodingEnvironment,
	SupportedAiProvider
} from './ai-provider-types';

const DEFAULT_MAX_OUTPUT_TOKENS = 10000;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TOP_P = 0.95;

export const AI_PROVIDER_DEFAULT_BASE_URLS: Record<SupportedAiProvider, string> = {
	openai: 'https://api.openai.com/v1',
	gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
	openrouter: 'https://openrouter.ai/api/v1'
};

const readEnvironmentValue = (key: string): string | undefined => {
	const importMetaEnv = import.meta.env as Record<string, string | boolean | undefined>;
	const importMetaValue = importMetaEnv[key];
	const processValue = process.env[key];

	if (typeof importMetaValue === 'string' && importMetaValue.trim().length > 0) {
		return importMetaValue.trim();
	}

	if (typeof processValue === 'string' && processValue.trim().length > 0) {
		return processValue.trim();
	}

	return undefined;
};

const resolveNumberEnvironmentValue = (
	key: string,
	fallbackValue: number,
	minimumValue: number,
	maximumValue: number
): number => {
	const rawValue = readEnvironmentValue(key);
	if (!rawValue) {
		return fallbackValue;
	}

	const numericValue = Number(rawValue);
	if (Number.isNaN(numericValue) || numericValue < minimumValue || numericValue > maximumValue) {
		console.warn(`⚠️ ${key}="${rawValue}" no es valido. Se usara ${fallbackValue}.`);
		return fallbackValue;
	}

	return numericValue;
};

const resolveRequiredEnvironmentValue = (key: string, helpMessage: string): string => {
	const value = readEnvironmentValue(key);
	if (!value) {
		throw new AiProviderConfigurationError(helpMessage);
	}

	return value;
};

/**
 * Resolves the server runtime mode used for debug logging.
 */
export const resolveCodingEnvironment = (): CodingEnvironment => {
	const rawValue = readEnvironmentValue('CODING_ENVIRONMENT')?.toLowerCase() ?? 'production';
	if (rawValue === 'development' || rawValue === 'production') {
		return rawValue;
	}

	console.warn(`⚠️ CODING_ENVIRONMENT="${rawValue}" no es valido. Se usara "production".`);
	return 'production';
};

const resolveProvider = (): SupportedAiProvider => {
	const rawValue = resolveRequiredEnvironmentValue(
		'AI_PROVIDER',
		'AI_PROVIDER no configurado. Usa openai, gemini u openrouter.'
	).toLowerCase();

	if (rawValue === 'openai' || rawValue === 'gemini' || rawValue === 'openrouter') {
		return rawValue;
	}

	throw new AiProviderConfigurationError(
		`AI_PROVIDER="${rawValue}" no es valido. Usa openai, gemini u openrouter.`
	);
};

const resolveBaseUrl = (provider: SupportedAiProvider): string => {
	const rawValue = readEnvironmentValue('AI_PROVIDER_BASE_URL') ?? AI_PROVIDER_DEFAULT_BASE_URLS[provider];

	try {
		new URL(rawValue);
		return rawValue;
	} catch (error) {
		throw new AiProviderConfigurationError(
			`AI_PROVIDER_BASE_URL="${rawValue}" no es una URL valida.`,
			error
		);
	}
};

const resolveDefaultHeaders = (provider: SupportedAiProvider): Record<string, string> => {
	if (provider !== 'openrouter') {
		return {};
	}

	const headers: Record<string, string> = {};
	const httpReferer = readEnvironmentValue('AI_OPENROUTER_HTTP_REFERER');
	const title = readEnvironmentValue('AI_OPENROUTER_TITLE');

	if (httpReferer) {
		headers['HTTP-Referer'] = httpReferer;
	}

	if (title) {
		headers['X-Title'] = title;
	}

	return headers;
};

/**
 * Resolves the provider-neutral AI runtime configuration from server env vars.
 */
export const resolveAiProviderRuntimeConfig = (): AiProviderRuntimeConfig => {
	const provider = resolveProvider();

	return {
		codingEnvironment: resolveCodingEnvironment(),
		provider,
		apiKey: resolveRequiredEnvironmentValue(
			'AI_PROVIDER_API_KEY',
			'AI_PROVIDER_API_KEY no configurada. Define la variable en el entorno de ejecucion del servidor.'
		),
		baseURL: resolveBaseUrl(provider),
		model: resolveRequiredEnvironmentValue(
			'AI_PROVIDER_MODEL',
			'AI_PROVIDER_MODEL no configurado. Define el modelo a usar para optimizacion y traduccion.'
		),
		maxOutputTokens: resolveNumberEnvironmentValue(
			'AI_MAX_OUTPUT_TOKENS',
			DEFAULT_MAX_OUTPUT_TOKENS,
			1,
			65535
		),
		temperature: resolveNumberEnvironmentValue('AI_TEMPERATURE', DEFAULT_TEMPERATURE, 0, 2),
		topP: resolveNumberEnvironmentValue('AI_TOP_P', DEFAULT_TOP_P, 0, 1),
		defaultHeaders: resolveDefaultHeaders(provider)
	};
};

/**
 * Keeps the existing upload/translate payload shape stable for the client.
 */
export const toConfiguredModels = (model: string): AiConfiguredModels => {
	return {
		processingModel: model,
		generationModel: model,
		translationModel: model
	};
};
