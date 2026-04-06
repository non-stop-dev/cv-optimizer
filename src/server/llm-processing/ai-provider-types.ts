import type { SupportedDocumentFormat, TargetPositions } from './upload/types';

export type CodingEnvironment = 'development' | 'production';
export type SupportedAiProvider = 'openai' | 'gemini' | 'openrouter';

export interface AiConfiguredModels {
	processingModel: string;
	generationModel: string;
	translationModel: string;
}

export interface AiProviderRuntimeConfig {
	codingEnvironment: CodingEnvironment;
	provider: SupportedAiProvider;
	apiKey: string;
	baseURL: string;
	model: string;
	maxOutputTokens: number;
	temperature: number;
	topP: number;
	defaultHeaders: Record<string, string>;
}

export interface AiProviderRuntimeMetadata extends AiConfiguredModels {
	codingEnvironment: CodingEnvironment;
	provider: SupportedAiProvider;
	maxOutputTokens: number;
	temperature: number;
	topP: number;
}

export interface AiSourceDocument {
	file: File;
	mimeType: string;
	format: SupportedDocumentFormat;
}

export interface AiStructuredOutputJsonSchema {
	type: 'json_schema';
	json_schema: {
		name: string;
		schema: Record<string, unknown>;
		description?: string;
		strict?: boolean;
	};
}

export type AiStructuredOutputFormat =
	| {
			type: 'json_object';
	  }
	| AiStructuredOutputJsonSchema;

export interface AiChatGenerationRequest {
	systemPrompt: string;
	userPrompt: string;
	sourceDocument?: AiSourceDocument;
	model?: string;
	maxOutputTokens?: number;
	temperature?: number;
	topP?: number;
	responseFormat?: AiStructuredOutputFormat;
}

export interface OptimizeCvRequest {
	content: string;
	targetPositions?: TargetPositions;
	sourceDocument?: AiSourceDocument;
}
