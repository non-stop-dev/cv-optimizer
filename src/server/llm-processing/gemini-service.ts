import {
	GoogleGenAI,
	HarmBlockThreshold,
	HarmCategory,
	ThinkingLevel,
	type GenerateContentConfig,
	type GenerateContentParameters
} from '@google/genai';

export class GeminiConfigurationError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'GeminiConfigurationError';
	}
}

type GeminiRequestErrorKind = 'generic' | 'provider-overloaded' | 'quota-exhausted';

export class GeminiRequestError extends Error {
	public readonly kind: GeminiRequestErrorKind;

	constructor(message: string, cause?: unknown, kind: GeminiRequestErrorKind = 'generic') {
		super(message, { cause });
		this.name = 'GeminiRequestError';
		this.kind = kind;
	}
}

interface ApiErrorInfo {
	status?: number;
	apiStatus?: string;
	apiCode?: number;
	reason?: string;
	message?: string;
	activationUrl?: string;
}

type CodingEnvironment = 'development' | 'production';

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
		const details = Array.isArray(parsed.error?.details) ? parsed.error?.details : [];
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

const DEFAULT_PROCESSING_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_GENERATION_MODEL = 'gemini-3-flash-preview';
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_THINKING_LEVEL = ThinkingLevel.LOW;
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
		console.warn(
			`⚠️ ${key}="${rawValue}" no es valido. Se usara ${fallbackValue}.`
		);
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

	console.warn(
		`⚠️ ${key}="${rawValue}" no es valido. Se usara ${String(fallbackValue)}.`
	);
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

/**
 * Singleton para gestionar la conexión con Gemini (Vertex AI / Google AI SDK)
 */
class GeminiService {
	private static instance: GeminiService;
	private ai: GoogleGenAI | null;
	private processingModelName: string;
	private generationModelName: string;
	private codingEnvironment: CodingEnvironment;
	private maxOutputTokens: number;
	private temperature: number;
	private topP: number;
	private thinkingLevel: ThinkingLevel;
	private enableGoogleSearchTool: boolean;

	private constructor() {
		this.codingEnvironment = resolveCodingEnvironment();
		this.processingModelName =
			import.meta.env.AI_MODEL_FOR_DOCUMENT_PROCESSING?.trim() ||
			process.env.AI_MODEL_FOR_DOCUMENT_PROCESSING?.trim() ||
			DEFAULT_PROCESSING_MODEL;
		this.generationModelName =
			import.meta.env.AI_MODEL_FOR_DOCUMENT_GENERATION?.trim() ||
			process.env.AI_MODEL_FOR_DOCUMENT_GENERATION?.trim() ||
			DEFAULT_GENERATION_MODEL;

		this.maxOutputTokens = resolveNumberEnvironmentValue(
			'AI_MAX_OUTPUT_TOKENS',
			import.meta.env.AI_MAX_OUTPUT_TOKENS?.trim() || process.env.AI_MAX_OUTPUT_TOKENS?.trim(),
			DEFAULT_MAX_OUTPUT_TOKENS,
			1,
			65535
		);
		this.temperature = resolveNumberEnvironmentValue(
			'AI_TEMPERATURE',
			import.meta.env.AI_TEMPERATURE?.trim() || process.env.AI_TEMPERATURE?.trim(),
			DEFAULT_TEMPERATURE,
			0,
			1
		);
		this.topP = resolveNumberEnvironmentValue(
			'AI_TOP_P',
			import.meta.env.AI_TOP_P?.trim() || process.env.AI_TOP_P?.trim(),
			DEFAULT_TOP_P,
			0,
			1
		);
		this.thinkingLevel = resolveThinkingLevel(
			import.meta.env.AI_THINKING_LEVEL?.trim() || process.env.AI_THINKING_LEVEL?.trim()
		);
		this.enableGoogleSearchTool = resolveBooleanEnvironmentValue(
			'AI_ENABLE_GOOGLE_SEARCH_TOOL',
			import.meta.env.AI_ENABLE_GOOGLE_SEARCH_TOOL?.trim() ||
				process.env.AI_ENABLE_GOOGLE_SEARCH_TOOL?.trim(),
			DEFAULT_ENABLE_GOOGLE_SEARCH_TOOL
		);

		const apiKey =
			import.meta.env.GEMINI_API_KEY?.trim() ||
			import.meta.env.GOOGLE_CLOUD_API_KEY?.trim() ||
			process.env.GEMINI_API_KEY?.trim() ||
			process.env.GOOGLE_CLOUD_API_KEY?.trim() ||
			null;

		if (!apiKey) {
			console.warn(
				'⚠️ GEMINI_API_KEY no configurada en runtime (import.meta.env/process.env). Las llamadas a IA fallarán.'
			);
			this.ai = null;
			return;
		}

		this.ai = new GoogleGenAI({
			apiKey
		});
	}

	private isDevelopmentEnvironment(): boolean {
		return this.codingEnvironment === 'development';
	}

	private logDevelopment(title: string, payload: string): void {
		if (!this.isDevelopmentEnvironment()) {
			return;
		}

		console.info(`\n[CV-OPTIMIZER][DEV] ${title}\n${payload}\n`);
	}

	public static getInstance(): GeminiService {
		if (!GeminiService.instance) {
			GeminiService.instance = new GeminiService();
		}
		return GeminiService.instance;
	}

	/**
	 * Configuración base para optimización de CV
	 */
	private getGenerationConfig(): GenerateContentConfig {
		const config: GenerateContentConfig = {
			maxOutputTokens: this.maxOutputTokens,
			temperature: this.temperature,
			topP: this.topP,
			thinkingConfig: {
				thinkingLevel: this.thinkingLevel
			},
			safetySettings: [
				{
					category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
					threshold: HarmBlockThreshold.OFF
				},
				{
					category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
					threshold: HarmBlockThreshold.OFF
				},
				{
					category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
					threshold: HarmBlockThreshold.OFF
				},
				{
					category: HarmCategory.HARM_CATEGORY_HARASSMENT,
					threshold: HarmBlockThreshold.OFF
				}
			]
		};

		if (this.enableGoogleSearchTool) {
			config.tools = [{ googleSearch: {} }];
		}

		return config;
	}

	private getClient(): GoogleGenAI {
		if (!this.ai) {
			throw new GeminiConfigurationError(
				'GEMINI_API_KEY no configurada. Define la variable en el entorno de ejecucion del servidor.'
			);
		}

		return this.ai;
	}

	public getConfiguredModels() {
		return {
			processingModel: this.processingModelName,
			generationModel: this.generationModelName
		};
	}

	/**
	 * Procesa el contenido del CV para optimizarlo
	 * @param content Texto sanitizado del CV
	 */
	public async optimizeCV(content: string) {
		const client = this.getClient();
		const systemPrompt = `
						You are an expert IT Recruiter and CV Optimization specialist.
						Transform the input into an ATS-optimized and human-readable CV with strong structure, clarity, and relevance.

						NON-NEGOTIABLE DATA INTEGRITY RULES:
						1. NEVER invent facts. Do not fabricate dates, companies, roles, metrics, education details, certifications, links, or responsibilities.
						2. If critical information is missing, insert explicit placeholders for manual completion.
						3. Placeholders must be visually highlight-ready using classes (for strong colors in UI):
							 - Use this exact pattern:
								 <span class="cv-placeholder cv-placeholder-critical">[COMPLETAR: ...]</span>
							 - Examples:
								 <span class="cv-placeholder cv-placeholder-critical">[COMPLETAR: FECHA_INICIO_MM/AAAA - FECHA_FIN_MM/AAAA]</span>
								 <span class="cv-placeholder cv-placeholder-critical">[COMPLETAR: NOMBRE_EMPRESA]</span>
								 <span class="cv-placeholder cv-placeholder-critical">[COMPLETAR: IMPACTO_CUANTIFICABLE]</span>
								 <span class="cv-placeholder cv-placeholder-critical">[COMPLETAR: INSTITUCION_Y_ANO_GRADUACION]</span>

						OUTPUT FORMAT RULES:
						4. Return only semantic HTML (NO markdown, NO inline CSS, NO style tags, NO scripts).
						5. Use semantic tags such as <header>, <section>, <h1>, <h2>, <h3>, <ul>, <li>, <p>, <span>.
						6. Keep language natural, concise, and professional. Avoid repetitive or generic AI-like phrasing.

						REQUIRED CV STRUCTURE:
						7. Include these sections with clear headings: Summary/Profile, Skills, Work Experience, Projects, Education.
						8. For each Work Experience entry include:
							 - Role title
							 - Company
							 - Date range
							 - 3-5 bullet points with concrete outcomes
							 If any item is missing, use placeholders.
						9. For each Project include objective, stack, and impact/result. Missing data must be placeholders.
						10. For Education include degree and institution/year; use placeholders if absent.

						CONTENT QUALITY RULES:
						11. Start bullet points with strong action verbs.
						12. Use metrics only when present in source data; otherwise use a metric placeholder.
						13. Embed relevant keywords naturally for ATS.
						14. Target length: 1-2 pages (approx. 400-800 words).
						15. Output language must be the same as the input language.
        `;

		this.logDevelopment(
			'Gemini request metadata',
			JSON.stringify(
				{
					codingEnvironment: this.codingEnvironment,
					generationModel: this.generationModelName,
					processingModel: this.processingModelName,
					contentLength: content.length,
					maxOutputTokens: this.maxOutputTokens,
					temperature: this.temperature,
					topP: this.topP,
					thinkingLevel: this.thinkingLevel,
					googleSearchToolEnabled: this.enableGoogleSearchTool
				},
				null,
				2
			)
		);
		this.logDevelopment('System prompt', systemPrompt);
		this.logDevelopment('Content sent to AI', content);

		try {
			const req: GenerateContentParameters = {
				model: this.generationModelName,
				contents: [{ role: 'user', parts: [{ text: content }] }],
				config: {
					...this.getGenerationConfig(),
					systemInstruction: systemPrompt
				}
			};

			const result = await client.models.generateContent(req);
			const text = result.text?.trim();

			if (!text) {
				throw new GeminiRequestError('La IA no devolvio contenido util para el CV.');
			}

			this.logDevelopment(
				'Gemini usage metadata',
				JSON.stringify(result.usageMetadata ?? {}, null, 2)
			);
			this.logDevelopment('AI response', text);

			return text;
		} catch (error) {
			if (error instanceof GeminiConfigurationError || error instanceof GeminiRequestError) {
				throw error;
			}

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
		}
	}
}

export const gemini = GeminiService.getInstance();
