import type {
	GenerateContentConfig,
	GenerateContentParameters,
	GoogleGenAI
} from '@google/genai';
import { GeminiRequestError } from './gemini-errors';

interface OptimizeCvWithGeminiParams {
	client: GoogleGenAI;
	generationModelName: string;
	generationConfig: GenerateContentConfig;
	systemPrompt: string;
	content: string;
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

export const optimizeCvWithGemini = async ({
	client,
	generationModelName,
	generationConfig,
	systemPrompt,
	content,
	logDevelopment,
	runtimeMetadata
}: OptimizeCvWithGeminiParams): Promise<string> => {
	logDevelopment(
		'Gemini request metadata',
		JSON.stringify(
			{
				codingEnvironment: runtimeMetadata.codingEnvironment,
				generationModel: runtimeMetadata.generationModel,
				processingModel: runtimeMetadata.processingModel,
				contentLength: content.length,
				maxOutputTokens: runtimeMetadata.maxOutputTokens,
				temperature: runtimeMetadata.temperature,
				topP: runtimeMetadata.topP,
				thinkingLevel: runtimeMetadata.thinkingLevel,
				googleSearchToolEnabled: runtimeMetadata.googleSearchToolEnabled
			},
			null,
			2
		)
	);
	logDevelopment('System prompt', systemPrompt);
	logDevelopment('Content sent to AI', content);

	const req: GenerateContentParameters = {
		model: generationModelName,
		contents: [{ role: 'user', parts: [{ text: content }] }],
		config: {
			...generationConfig,
			systemInstruction: systemPrompt
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
