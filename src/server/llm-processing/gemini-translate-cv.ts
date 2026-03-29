import {
	createUserContent,
	type GenerateContentConfig,
	type GenerateContentParameters,
	type GoogleGenAI
} from '@google/genai';
import { GeminiRequestError } from './gemini-errors';

interface TranslateCvToEnglishWithGeminiParams {
	client: GoogleGenAI;
	translationModelName: string;
	generationConfig: GenerateContentConfig;
	htmlContent: string;
	logDevelopment: (title: string, payload: string) => void;
	runtimeMetadata: {
		codingEnvironment: string;
		translationModel: string;
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

const TRANSLATION_SYSTEM_PROMPT = normalizeModelMessage([
	'You are an expert CV translator specialized in high-fidelity HTML translation.',
	'You are precise and must preserve structure, semantics, and styling markers.'
].join('\n'));

const buildTranslationUserContent = (htmlContent: string): string => {
	const normalizedHtml = normalizeModelMessage(htmlContent);

	return normalizeModelMessage([
		'<task>',
		'Translate the provided CV HTML to English only.',
		'Preserve the exact HTML structure, section order, tag hierarchy, class names, and attributes.',
		'Do not remove, add, or reorder sections.',
		'Do not alter links, placeholders styling classes, or visual markers.',
		'Do not inject new content, explanations, markdown, CSS, scripts, or comments.',
		'Return only translated semantic HTML.',
		'</task>',
		'',
		'<source_cv_html>',
		normalizedHtml,
		'</source_cv_html>'
	].join('\n'));
};

export const translateCvToEnglishWithGemini = async ({
	client,
	translationModelName,
	generationConfig,
	htmlContent,
	logDevelopment,
	runtimeMetadata
}: TranslateCvToEnglishWithGeminiParams): Promise<string> => {
	const userContent = buildTranslationUserContent(htmlContent);

	logDevelopment(
		'Gemini translation metadata',
		JSON.stringify(
			{
				codingEnvironment: runtimeMetadata.codingEnvironment,
				translationModel: runtimeMetadata.translationModel,
				rawContentLength: htmlContent.length,
				normalizedContentLength: userContent.length,
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
	logDevelopment('Translation system prompt', TRANSLATION_SYSTEM_PROMPT);
	logDevelopment('Translation content sent to AI', userContent);

	const request: GenerateContentParameters = {
		model: translationModelName,
		contents: [createUserContent(userContent)],
		config: {
			...generationConfig,
			systemInstruction: TRANSLATION_SYSTEM_PROMPT
		}
	};

	const result = await client.models.generateContent(request);
	const translatedHtml = result.text?.trim();
	if (!translatedHtml) {
		throw new GeminiRequestError('La IA no devolvio contenido util para la traduccion del CV.');
	}

	logDevelopment('Gemini translation usage metadata', JSON.stringify(result.usageMetadata ?? {}, null, 2));
	logDevelopment('AI translation response', translatedHtml);

	return translatedHtml;
};
