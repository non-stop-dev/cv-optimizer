import type { GenerateContentParameters, GoogleGenAI } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';

import { translateCvToEnglishWithGemini } from './gemini-translate-cv';

const extractUserText = (request: GenerateContentParameters): string => {
	if (!Array.isArray(request.contents) || request.contents.length === 0) {
		return '';
	}

	const firstContent = request.contents[0];
	if (!firstContent || typeof firstContent !== 'object' || !('parts' in firstContent)) {
		return '';
	}

	const parts = firstContent.parts;
	if (!Array.isArray(parts) || parts.length === 0) {
		return '';
	}

	for (const part of parts) {
		if (!part || typeof part !== 'object' || !('text' in part)) {
			continue;
		}

		if (typeof part.text === 'string') {
			return part.text;
		}
	}

	return '';
};

describe('translateCvToEnglishWithGemini', () => {
	it('envia instruccion de traduccion conservando estructura HTML', async () => {
		const generateContent = vi.fn().mockResolvedValue({ text: '<section><p>Hello world</p></section>' });
		const client = {
			models: {
				generateContent
			}
		} as unknown as GoogleGenAI;

		await translateCvToEnglishWithGemini({
			client,
			translationModelName: 'gemini-translation-model',
			generationConfig: {},
			htmlContent: '<section><p>Hola mundo</p></section>',
			logDevelopment: () => {
				// no-op
			},
			runtimeMetadata: {
				codingEnvironment: 'test',
				translationModel: 'gemini-translation-model',
				maxOutputTokens: 10000,
				temperature: 1,
				topP: 0.95,
				thinkingLevel: 'low',
				googleSearchToolEnabled: false
			}
		});

		expect(generateContent).toHaveBeenCalledTimes(1);
		const request = generateContent.mock.calls[0]?.[0] as GenerateContentParameters;
		expect(request.model).toBe('gemini-translation-model');
		expect(String(request.config?.systemInstruction)).toContain('expert CV translator');

		const userText = extractUserText(request);
		expect(userText).toContain('<task>');
		expect(userText).toContain('Translate the provided CV HTML to English only.');
		expect(userText).toContain('Preserve the exact HTML structure');
		expect(userText).toContain('<source_cv_html>');
		expect(userText).toContain('<section><p>Hola mundo</p></section>');
	});

	it('falla cuando la IA no devuelve texto traducido', async () => {
		const generateContent = vi.fn().mockResolvedValue({ text: '   ' });
		const client = {
			models: {
				generateContent
			}
		} as unknown as GoogleGenAI;

		await expect(
			translateCvToEnglishWithGemini({
				client,
				translationModelName: 'gemini-translation-model',
				generationConfig: {},
				htmlContent: '<p>Hola</p>',
				logDevelopment: () => {
					// no-op
				},
				runtimeMetadata: {
					codingEnvironment: 'test',
					translationModel: 'gemini-translation-model',
					maxOutputTokens: 10000,
					temperature: 1,
					topP: 0.95,
					thinkingLevel: 'low',
					googleSearchToolEnabled: false
				}
			})
		).rejects.toThrow('La IA no devolvio contenido util para la traduccion del CV.');
	});
});
