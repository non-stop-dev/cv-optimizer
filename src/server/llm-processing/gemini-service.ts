import {
	GoogleGenAI,
	type GenerateContentConfig
} from '@google/genai';
import { mapGeminiUnknownError } from './gemini-api-errors';
import { buildGenerationConfig, resolveGeminiRuntimeConfig } from './gemini-config';
import { GeminiConfigurationError, GeminiRequestError } from './gemini-errors';
import { optimizeCvWithGemini } from './gemini-optimize-cv';
import { GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT } from './gemini-system-prompt';
import { translateCvToEnglishWithGemini } from './gemini-translate-cv';
import type { SupportedDocumentFormat, TargetPositions } from './upload/types';

type CodingEnvironment = 'development' | 'production';

interface GeminiRuntimeMetadata {
	codingEnvironment: string;
	processingModel: string;
	generationModel: string;
	translationModel: string;
	maxOutputTokens: number;
	temperature: number;
	topP: number;
	thinkingLevel: string;
	googleSearchToolEnabled: boolean;
}

interface OptimizeCvSourceDocument {
	file: File;
	mimeType: string;
	format: SupportedDocumentFormat;
}

/**
 * Singleton para gestionar la conexión con Gemini (Vertex AI / Google AI SDK)
 */
class GeminiService {
	private static instance: GeminiService;
	private ai: GoogleGenAI | null;
	private processingModelName: string;
	private generationModelName: string;
	private translationModelName: string;
	private codingEnvironment: CodingEnvironment;
	private generationConfig: GenerateContentConfig;
	private runtimeMetadata: GeminiRuntimeMetadata;

	private constructor() {
		const runtimeConfig = resolveGeminiRuntimeConfig();
		this.codingEnvironment = runtimeConfig.codingEnvironment;
		this.processingModelName = runtimeConfig.processingModelName;
		this.generationModelName = runtimeConfig.generationModelName;
		this.translationModelName = runtimeConfig.translationModelName;
		this.generationConfig = buildGenerationConfig(runtimeConfig);
		this.runtimeMetadata = {
			codingEnvironment: runtimeConfig.codingEnvironment,
			processingModel: runtimeConfig.processingModelName,
			generationModel: runtimeConfig.generationModelName,
			translationModel: runtimeConfig.translationModelName,
			maxOutputTokens: runtimeConfig.maxOutputTokens,
			temperature: runtimeConfig.temperature,
			topP: runtimeConfig.topP,
			thinkingLevel: String(runtimeConfig.thinkingLevel),
			googleSearchToolEnabled: runtimeConfig.enableGoogleSearchTool
		};

		if (!runtimeConfig.apiKey) {
			console.warn(
				'⚠️ GEMINI_API_KEY no configurada en runtime (import.meta.env/process.env). Las llamadas a IA fallarán.'
			);
			this.ai = null;
			return;
		}

		this.ai = new GoogleGenAI({
			apiKey: runtimeConfig.apiKey
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
			generationModel: this.generationModelName,
			translationModel: this.translationModelName
		};
	}

	/**
	 * Procesa el contenido del CV para optimizarlo
	 * @param content Texto sanitizado del CV
	 */
	public async optimizeCV(
		content: string,
		targetPositions: TargetPositions = [],
		sourceDocument?: OptimizeCvSourceDocument
	): Promise<string> {
		const client = this.getClient();
		try {
			return await optimizeCvWithGemini({
				client,
				generationModelName: this.generationModelName,
				generationConfig: this.generationConfig,
				systemPrompt: GEMINI_CV_OPTIMIZER_SYSTEM_PROMPT,
				content,
				targetPositions,
				sourceDocument,
				logDevelopment: this.logDevelopment.bind(this),
				runtimeMetadata: this.runtimeMetadata
			});
		} catch (error) {
			if (error instanceof GeminiConfigurationError || error instanceof GeminiRequestError) {
				throw error;
			}
			return mapGeminiUnknownError(error);
		}
	}

	public async translateCvToEnglish(optimizedHtml: string): Promise<string> {
		const client = this.getClient();
		try {
			return await translateCvToEnglishWithGemini({
				client,
				translationModelName: this.translationModelName,
				generationConfig: this.generationConfig,
				htmlContent: optimizedHtml,
				logDevelopment: this.logDevelopment.bind(this),
				runtimeMetadata: this.runtimeMetadata
			});
		} catch (error) {
			if (error instanceof GeminiConfigurationError || error instanceof GeminiRequestError) {
				throw error;
			}
			return mapGeminiUnknownError(error);
		}
	}
}

export const gemini = GeminiService.getInstance();
export { GeminiConfigurationError, GeminiRequestError };
