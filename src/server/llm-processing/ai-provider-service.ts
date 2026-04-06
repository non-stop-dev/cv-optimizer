import { GoogleGenAI } from '@google/genai';
import type OpenAI from 'openai';

import { resolveAiProviderRuntimeConfig, toConfiguredModels } from './ai-provider-config';
import { mapGeminiNativePdfError } from './ai-provider-error-mapper';
import {
	AiProviderConfigurationError,
	AiProviderRequestError
} from './ai-provider-errors';
import { optimizeCvWithGeminiNativePdf } from './ai-provider-gemini-native-pdf';
import {
	buildOpenAiCompatibleChatRequest,
	buildOptimizeCvUserContent,
	buildTranslationUserContent,
	extractChatCompletionText,
	isPdfSourceDocument,
	TRANSLATION_SYSTEM_PROMPT
} from './ai-provider-openai-compatible-request';
import {
	createOpenAiCompatibleClient,
	executeOpenAiCompatibleChatText
} from './ai-provider-openai-compatible-client';
import { CV_OPTIMIZER_SYSTEM_PROMPT } from './cv-optimizer-system-prompt';
import type {
	AiChatGenerationRequest,
	AiConfiguredModels,
	AiProviderRuntimeConfig,
	AiProviderRuntimeMetadata,
	OptimizeCvRequest
} from './ai-provider-types';

interface AiProviderServiceDependencies {
	createOpenAiClient?: (config: AiProviderRuntimeConfig) => OpenAI;
	createGeminiPdfClient?: (apiKey: string) => GoogleGenAI;
	executeOpenAiCompatibleChat?: typeof executeOpenAiCompatibleChatText;
	optimizeCvWithGeminiNativePdf?: typeof optimizeCvWithGeminiNativePdf;
}

/**
 * Provider-neutral facade used by the upload and translation routes.
 */
export class AiProviderService {
	private static instance: AiProviderService;

	private readonly createOpenAiClient: (config: AiProviderRuntimeConfig) => OpenAI;
	private readonly createGeminiPdfClient: (apiKey: string) => GoogleGenAI;
	private readonly executeOpenAiCompatibleChat: typeof executeOpenAiCompatibleChatText;
	private readonly optimizeCvWithGeminiNativePdf: typeof optimizeCvWithGeminiNativePdf;
	private readonly initializationError: AiProviderConfigurationError | null;
	private readonly runtimeConfig: AiProviderRuntimeConfig | null;
	private readonly openAiClient: OpenAI | null;

	constructor(
		runtimeConfig?: AiProviderRuntimeConfig,
		dependencies: AiProviderServiceDependencies = {}
	) {
		this.createOpenAiClient =
			dependencies.createOpenAiClient ?? createOpenAiCompatibleClient;
		this.createGeminiPdfClient =
			dependencies.createGeminiPdfClient ?? ((apiKey) => new GoogleGenAI({ apiKey }));
		this.executeOpenAiCompatibleChat =
			dependencies.executeOpenAiCompatibleChat ?? executeOpenAiCompatibleChatText;
		this.optimizeCvWithGeminiNativePdf =
			dependencies.optimizeCvWithGeminiNativePdf ?? optimizeCvWithGeminiNativePdf;

		try {
			this.runtimeConfig = runtimeConfig ?? resolveAiProviderRuntimeConfig();
			this.initializationError = null;
			this.openAiClient = this.createOpenAiClient(this.runtimeConfig);
		} catch (error) {
			if (error instanceof AiProviderConfigurationError) {
				console.warn(`⚠️ ${error.message}`);
				this.initializationError = error;
				this.runtimeConfig = null;
				this.openAiClient = null;
				return;
			}

			throw error;
		}
	}

	public static getInstance(): AiProviderService {
		if (!AiProviderService.instance) {
			AiProviderService.instance = new AiProviderService();
		}

		return AiProviderService.instance;
	}

	private getRuntimeConfig(): AiProviderRuntimeConfig {
		if (this.initializationError) {
			throw this.initializationError;
		}

		if (!this.runtimeConfig) {
			throw new AiProviderConfigurationError('No se pudo inicializar la configuracion del proveedor de IA.');
		}

		return this.runtimeConfig;
	}

	private getOpenAiClient(): OpenAI {
		if (this.initializationError) {
			throw this.initializationError;
		}

		if (!this.openAiClient) {
			throw new AiProviderConfigurationError('No se pudo crear el cliente del proveedor de IA.');
		}

		return this.openAiClient;
	}

	private getRuntimeMetadata(): AiProviderRuntimeMetadata {
		const runtimeConfig = this.getRuntimeConfig();
		return {
			codingEnvironment: runtimeConfig.codingEnvironment,
			provider: runtimeConfig.provider,
			...toConfiguredModels(runtimeConfig.model),
			maxOutputTokens: runtimeConfig.maxOutputTokens,
			temperature: runtimeConfig.temperature,
			topP: runtimeConfig.topP
		};
	}

	private isDevelopmentEnvironment(): boolean {
		return this.getRuntimeConfig().codingEnvironment === 'development';
	}

	private logDevelopment(title: string, payload: string): void {
		if (!this.isDevelopmentEnvironment()) {
			return;
		}

		console.info(`\n[CV-OPTIMIZER][DEV] ${title}\n${payload}\n`);
	}

	public getConfiguredModels(): AiConfiguredModels {
		return toConfiguredModels(this.getRuntimeConfig().model);
	}

	/**
	 * Shared provider operation for text generation and optional structured outputs.
	 */
	public async generateChatText(request: AiChatGenerationRequest): Promise<string> {
		const runtimeConfig = this.getRuntimeConfig();
		const builtRequest = await buildOpenAiCompatibleChatRequest(runtimeConfig.provider, {
			...request,
			model: request.model ?? runtimeConfig.model,
			maxOutputTokens: request.maxOutputTokens ?? runtimeConfig.maxOutputTokens,
			temperature: request.temperature ?? runtimeConfig.temperature,
			topP: request.topP ?? runtimeConfig.topP
		});

		this.logDevelopment(
			'OpenAI-compatible request metadata',
			JSON.stringify(
				{
					codingEnvironment: runtimeConfig.codingEnvironment,
					provider: runtimeConfig.provider,
					model: request.model ?? runtimeConfig.model,
					rawContentLength: request.userPrompt.length,
					normalizedContentLength: builtRequest.userContent.length,
					maxOutputTokens: request.maxOutputTokens ?? runtimeConfig.maxOutputTokens,
					temperature: request.temperature ?? runtimeConfig.temperature,
					topP: request.topP ?? runtimeConfig.topP,
					hasPdfAttachment: builtRequest.hasPdfAttachment
				},
				null,
				2
			)
		);
		this.logDevelopment('System prompt', builtRequest.normalizedSystemPrompt);
		this.logDevelopment('Content sent to AI', builtRequest.userContent);

		const completion = await this.executeOpenAiCompatibleChat({
			client: this.getOpenAiClient(),
			provider: runtimeConfig.provider,
			request: builtRequest.request,
			emptyResponseMessage: 'La IA no devolvio contenido util.',
			fallbackErrorMessage: 'No se pudo procesar la solicitud con el proveedor de IA.'
		});

		this.logDevelopment('OpenAI-compatible usage metadata', JSON.stringify(completion.usage ?? {}, null, 2));
		const text = extractChatCompletionText(completion);
		this.logDevelopment('AI response', text);
		return text;
	}

	/**
	 * Optimizes a sanitized CV while keeping the provider-specific transport hidden.
	 */
	public async optimizeCV({
		content,
		targetPositions = [],
		sourceDocument
	}: OptimizeCvRequest): Promise<string> {
		const runtimeConfig = this.getRuntimeConfig();
		const runtimeMetadata = this.getRuntimeMetadata();

		if (runtimeConfig.provider === 'gemini' && isPdfSourceDocument(sourceDocument)) {
			try {
				return await this.optimizeCvWithGeminiNativePdf({
					client: this.createGeminiPdfClient(runtimeConfig.apiKey),
					model: runtimeConfig.model,
					systemPrompt: CV_OPTIMIZER_SYSTEM_PROMPT,
					content,
					targetPositions,
					sourceDocument,
					logDevelopment: this.logDevelopment.bind(this),
					runtimeMetadata
				});
			} catch (error) {
				if (error instanceof AiProviderConfigurationError || error instanceof AiProviderRequestError) {
					throw error;
				}

				return mapGeminiNativePdfError(error);
			}
		}

		return this.generateChatText({
			systemPrompt: CV_OPTIMIZER_SYSTEM_PROMPT,
			userPrompt: buildOptimizeCvUserContent(
				content,
				targetPositions,
				isPdfSourceDocument(sourceDocument)
			),
			sourceDocument
		});
	}

	/**
	 * Translates optimized CV HTML to English using the configured provider model.
	 */
	public async translateCvToEnglish(optimizedHtml: string): Promise<string> {
		return this.generateChatText({
			systemPrompt: TRANSLATION_SYSTEM_PROMPT,
			userPrompt: buildTranslationUserContent(optimizedHtml)
		});
	}
}

export const aiProvider = AiProviderService.getInstance();
export { AiProviderConfigurationError, AiProviderRequestError };
