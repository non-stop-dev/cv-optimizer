import type {
	GenerateContentConfig,
	GenerateContentParameters,
	GoogleGenAI
} from '@google/genai';
import { GeminiRequestError } from './gemini-errors';
import type { TargetPositions } from './upload/types';

interface OptimizeCvWithGeminiParams {
	client: GoogleGenAI;
	generationModelName: string;
	generationConfig: GenerateContentConfig;
	systemPrompt: string;
	content: string;
	targetPositions: TargetPositions;
	logDevelopment: (title: string, payload: string) => void;
	runtimeMetadata: {
		codingEnvironment: string;
		processingModel: string;
		generationModel: string;
		maxOutputTokens: number;
		temperature: number;
		topP: number;
		thinkingLevel: string;
		googleSearchToolEnabled: boolean;
	};
}

const normalizeModelMessage = (value: string): string => {
	return value
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};

const buildUserContent = (content: string, targetPositions: TargetPositions): string => {
	const normalizedContent = normalizeModelMessage(content);

	if (targetPositions.length === 0) {
		return normalizedContent;
	}

	const positionsList = targetPositions
		.map((position, index) => `${index + 1}. ${normalizeModelMessage(position).replace(/\n+/g, ' ')}`)
		.join('\n');

	return normalizeModelMessage([
		'Target positions to optimize for (without inventing experience):',
		positionsList,
		'',
		'CV source content:',
		normalizedContent
	].join('\n'));
};

export const optimizeCvWithGemini = async ({
	client,
	generationModelName,
	generationConfig,
	systemPrompt,
	content,
	targetPositions,
	logDevelopment,
	runtimeMetadata
}: OptimizeCvWithGeminiParams): Promise<string> => {
	const userContent = buildUserContent(content, targetPositions);
	const normalizedSystemPrompt = normalizeModelMessage(systemPrompt);

	logDevelopment(
		'Gemini request metadata',
		JSON.stringify(
			{
				codingEnvironment: runtimeMetadata.codingEnvironment,
				generationModel: runtimeMetadata.generationModel,
				processingModel: runtimeMetadata.processingModel,
				rawContentLength: content.length,
				normalizedContentLength: userContent.length,
				maxOutputTokens: runtimeMetadata.maxOutputTokens,
				temperature: runtimeMetadata.temperature,
				topP: runtimeMetadata.topP,
				thinkingLevel: runtimeMetadata.thinkingLevel,
				googleSearchToolEnabled: runtimeMetadata.googleSearchToolEnabled,
				targetPositions,
				targetPositionsCount: targetPositions.length
			},
			null,
			2
		)
	);
	logDevelopment('System prompt', normalizedSystemPrompt);
	logDevelopment('Content sent to AI', userContent);

	const req: GenerateContentParameters = {
		model: generationModelName,
		contents: [{ role: 'user', parts: [{ text: userContent }] }],
		config: {
			...generationConfig,
			systemInstruction: normalizedSystemPrompt
		}
	};

	const result = await client.models.generateContent(req);
	const text = result.text?.trim();
	if (!text) {
		throw new GeminiRequestError('La IA no devolvio contenido util para el CV.');
	}

	logDevelopment('Gemini usage metadata', JSON.stringify(result.usageMetadata ?? {}, null, 2));
	logDevelopment('AI response', text);

	return text;
};
