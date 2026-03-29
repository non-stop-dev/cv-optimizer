import {
	HarmBlockThreshold,
	HarmCategory,
	ThinkingLevel,
	type GenerateContentConfig
} from '@google/genai';

export type CodingEnvironment = 'development' | 'production';
export type GeminiSafetyMode = 'strict' | 'relaxed' | 'off';

export interface GeminiRuntimeConfig {
	codingEnvironment: CodingEnvironment;
	processingModelName: string;
	generationModelName: string;
	translationModelName: string;
	maxOutputTokens: number;
	temperature: number;
	topP: number;
	thinkingLevel: ThinkingLevel;
	safetyMode: GeminiSafetyMode;
	enableGoogleSearchTool: boolean;
	apiKey: string | null;
}

const DEFAULT_PROCESSING_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_GENERATION_MODEL = 'gemini-3-flash-preview';
const DEFAULT_TRANSLATION_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_MAX_OUTPUT_TOKENS = 10000;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_THINKING_LEVEL = ThinkingLevel.LOW;
const DEFAULT_PRODUCTION_SAFETY_MODE: GeminiSafetyMode = 'strict';
const DEFAULT_DEVELOPMENT_SAFETY_MODE: GeminiSafetyMode = 'relaxed';
const DEFAULT_ENABLE_GOOGLE_SEARCH_TOOL = false;

const resolveNumberEnvironmentValue = (
	key: string,
	rawValue: string | undefined,
	fallbackValue: number,
	minimumValue: number,
	maximumValue: number
): number => {
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

const resolveBooleanEnvironmentValue = (
	key: string,
	rawValue: string | undefined,
	fallbackValue: boolean
): boolean => {
	if (!rawValue) {
		return fallbackValue;
	}

	const normalizedValue = rawValue.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
		return true;
	}

	if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
		return false;
	}

	console.warn(`⚠️ ${key}="${rawValue}" no es valido. Se usara ${String(fallbackValue)}.`);
	return fallbackValue;
};

const resolveThinkingLevel = (rawValue: string | undefined): ThinkingLevel => {
	if (!rawValue) {
		return DEFAULT_THINKING_LEVEL;
	}

	const normalizedValue = rawValue.trim().toLowerCase();
	if (normalizedValue === 'minimal') {
		return ThinkingLevel.MINIMAL;
	}
	if (normalizedValue === 'low') {
		return ThinkingLevel.LOW;
	}
	if (normalizedValue === 'medium') {
		return ThinkingLevel.MEDIUM;
	}
	if (normalizedValue === 'high') {
		return ThinkingLevel.HIGH;
	}

	console.warn(
		`⚠️ AI_THINKING_LEVEL="${rawValue}" no es valido. Se usara "${DEFAULT_THINKING_LEVEL}".`
	);
	return DEFAULT_THINKING_LEVEL;
};

const resolveSafetyMode = (
	rawValue: string | undefined,
	codingEnvironment: CodingEnvironment
): GeminiSafetyMode => {
	const defaultSafetyMode =
		codingEnvironment === 'production'
			? DEFAULT_PRODUCTION_SAFETY_MODE
			: DEFAULT_DEVELOPMENT_SAFETY_MODE;

	if (!rawValue) {
		return defaultSafetyMode;
	}

	const normalizedValue = rawValue.trim().toLowerCase();
	if (normalizedValue === 'strict') {
		return 'strict';
	}
	if (normalizedValue === 'relaxed') {
		return 'relaxed';
	}
	if (normalizedValue === 'off') {
		return 'off';
	}

	console.warn(
		`⚠️ AI_SAFETY_MODE="${rawValue}" no es valido. Se usara "${defaultSafetyMode}" para ${codingEnvironment}.`
	);
	return defaultSafetyMode;
};

const resolveSafetyThreshold = (safetyMode: GeminiSafetyMode): HarmBlockThreshold => {
	if (safetyMode === 'strict') {
		return HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
	}
	if (safetyMode === 'relaxed') {
		return HarmBlockThreshold.BLOCK_ONLY_HIGH;
	}

	return HarmBlockThreshold.OFF;
};

export const resolveCodingEnvironment = (): CodingEnvironment => {
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

export const resolveGeminiRuntimeConfig = (): GeminiRuntimeConfig => {
	const codingEnvironment = resolveCodingEnvironment();

	const apiKey =
		import.meta.env.GEMINI_API_KEY?.trim() ||
		import.meta.env.GOOGLE_CLOUD_API_KEY?.trim() ||
		process.env.GEMINI_API_KEY?.trim() ||
		process.env.GOOGLE_CLOUD_API_KEY?.trim() ||
		null;

	return {
		codingEnvironment,
		processingModelName:
			import.meta.env.AI_MODEL_FOR_DOCUMENT_PROCESSING?.trim() ||
			process.env.AI_MODEL_FOR_DOCUMENT_PROCESSING?.trim() ||
			DEFAULT_PROCESSING_MODEL,
		generationModelName:
			import.meta.env.AI_MODEL_FOR_DOCUMENT_GENERATION?.trim() ||
			process.env.AI_MODEL_FOR_DOCUMENT_GENERATION?.trim() ||
			DEFAULT_GENERATION_MODEL,
		translationModelName:
			import.meta.env.AI_MODEL_FOR_DOCUMENT_TRANSLATION?.trim() ||
			process.env.AI_MODEL_FOR_DOCUMENT_TRANSLATION?.trim() ||
			DEFAULT_TRANSLATION_MODEL,
		maxOutputTokens: resolveNumberEnvironmentValue(
			'AI_MAX_OUTPUT_TOKENS',
			import.meta.env.AI_MAX_OUTPUT_TOKENS?.trim() || process.env.AI_MAX_OUTPUT_TOKENS?.trim(),
			DEFAULT_MAX_OUTPUT_TOKENS,
			1,
			65535
		),
		temperature: resolveNumberEnvironmentValue(
			'AI_TEMPERATURE',
			import.meta.env.AI_TEMPERATURE?.trim() || process.env.AI_TEMPERATURE?.trim(),
			DEFAULT_TEMPERATURE,
			0,
			1
		),
		topP: resolveNumberEnvironmentValue(
			'AI_TOP_P',
			import.meta.env.AI_TOP_P?.trim() || process.env.AI_TOP_P?.trim(),
			DEFAULT_TOP_P,
			0,
			1
		),
		thinkingLevel: resolveThinkingLevel(
			import.meta.env.AI_THINKING_LEVEL?.trim() || process.env.AI_THINKING_LEVEL?.trim()
		),
		safetyMode: resolveSafetyMode(
			import.meta.env.AI_SAFETY_MODE?.trim() || process.env.AI_SAFETY_MODE?.trim(),
			codingEnvironment
		),
		enableGoogleSearchTool: resolveBooleanEnvironmentValue(
			'AI_ENABLE_GOOGLE_SEARCH_TOOL',
			import.meta.env.AI_ENABLE_GOOGLE_SEARCH_TOOL?.trim() ||
				process.env.AI_ENABLE_GOOGLE_SEARCH_TOOL?.trim(),
			DEFAULT_ENABLE_GOOGLE_SEARCH_TOOL
		),
		apiKey
	};
};

export const buildGenerationConfig = (runtimeConfig: GeminiRuntimeConfig): GenerateContentConfig => {
	const safetyThreshold = resolveSafetyThreshold(runtimeConfig.safetyMode);

	const config: GenerateContentConfig = {
		maxOutputTokens: runtimeConfig.maxOutputTokens,
		temperature: runtimeConfig.temperature,
		topP: runtimeConfig.topP,
		thinkingConfig: {
			thinkingLevel: runtimeConfig.thinkingLevel
		},
		safetySettings: [
			{
				category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
				threshold: safetyThreshold
			},
			{
				category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
				threshold: safetyThreshold
			},
			{
				category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
				threshold: safetyThreshold
			},
			{
				category: HarmCategory.HARM_CATEGORY_HARASSMENT,
				threshold: safetyThreshold
			}
		]
	};

	if (runtimeConfig.enableGoogleSearchTool) {
		config.tools = [{ googleSearch: {} }];
	}

	return config;
};
