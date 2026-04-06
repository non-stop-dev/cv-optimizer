import type {
	ChatCompletionCreateParamsNonStreaming,
	ChatCompletionMessageParam
} from 'openai/resources/chat/completions/completions';
import { describe, expect, it } from 'vitest';

import {
	buildOpenAiCompatibleChatRequest,
	buildOptimizeCvUserContent,
	buildTranslationUserContent,
	extractChatCompletionText
} from './ai-provider-openai-compatible-request';
import { CV_OPTIMIZER_SYSTEM_PROMPT } from './cv-optimizer-system-prompt';

const extractUserMessage = (messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam | undefined => {
	return messages.find((message) => message.role === 'user');
};

describe('buildOpenAiCompatibleChatRequest', () => {
	it('mantiene persona en system y reglas en el mensaje del usuario', async () => {
		const userPrompt = buildOptimizeCvUserContent(
			'Experiencia: Analista de datos',
			['Analista de datos'],
			false
		);

		const builtRequest = await buildOpenAiCompatibleChatRequest('openai', {
			systemPrompt: CV_OPTIMIZER_SYSTEM_PROMPT,
			userPrompt,
			model: 'gpt-4o-mini',
			maxOutputTokens: 4096,
			temperature: 1,
			topP: 0.95
		});

		expect(builtRequest.normalizedSystemPrompt).toBe(CV_OPTIMIZER_SYSTEM_PROMPT);
		expect(builtRequest.normalizedSystemPrompt).not.toContain('NON-NEGOTIABLE DATA INTEGRITY RULES');
		expect(builtRequest.normalizedSystemPrompt).toContain(
			'Normalize visually noisy, malformed, or leetspeak characters to their standard spelling'
		);

		const request = builtRequest.request as ChatCompletionCreateParamsNonStreaming;
		const userMessage = extractUserMessage(request.messages);

		expect(userMessage).toBeDefined();
		expect(userMessage && typeof userMessage.content === 'string' ? userMessage.content : '').toContain(
			'NON-NEGOTIABLE DATA INTEGRITY RULES'
		);
		expect(userMessage && typeof userMessage.content === 'string' ? userMessage.content : '').toContain(
			'Personal Information + Professional Summary/Profile in the first section.'
		);
		expect(userMessage && typeof userMessage.content === 'string' ? userMessage.content : '').toContain(
			'<security>'
		);
	});

	it('normaliza espacios y mantiene target positions cuando no hay PDF', () => {
		const userPrompt = buildOptimizeCvUserContent('Linea 1\r\n\r\n\r\nLinea 2   ', [], false);

		expect(userPrompt).not.toContain('\r');
		expect(userPrompt).not.toContain('\n\n\n');
		expect(userPrompt).toContain('<target_positions>None provided.</target_positions>');
		expect(userPrompt).toContain('Linea 1\n\nLinea 2');
	});

	it('construye request PDF nativo para OpenRouter sin fallback implicito', async () => {
		const pdfFile = new File(['%PDF-1.4 fake content'], 'milagros-cv.pdf', {
			type: 'application/pdf'
		});

		const builtRequest = await buildOpenAiCompatibleChatRequest('openrouter', {
			systemPrompt: CV_OPTIMIZER_SYSTEM_PROMPT,
			userPrompt: buildOptimizeCvUserContent('NO_DEBERIA_APARECER', ['Recepcionista'], true),
			model: 'openai/gpt-4o-mini',
			maxOutputTokens: 4096,
			temperature: 1,
			topP: 0.95,
			sourceDocument: {
				file: pdfFile,
				mimeType: 'application/pdf',
				format: 'pdf'
			}
		});

		const request = builtRequest.request as ChatCompletionCreateParamsNonStreaming & {
			plugins?: Array<{ id: string; pdf?: { engine: string } }>;
		};
		const userMessage = extractUserMessage(request.messages);

		expect(Array.isArray(userMessage?.content)).toBe(true);
		expect(request.plugins).toEqual([
			{
				id: 'file-parser',
				pdf: {
					engine: 'native'
				}
			}
		]);
		expect(Array.isArray(userMessage?.content) ? userMessage?.content[0] : null).toMatchObject({
			type: 'file',
			file: {
				filename: 'milagros-cv.pdf'
			}
		});
		expect(Array.isArray(userMessage?.content) ? userMessage?.content[1] : null).toMatchObject({
			type: 'text'
		});
	});

	it('construye el prompt de traduccion preservando HTML', () => {
		const userPrompt = buildTranslationUserContent('<section><p>Hola mundo</p></section>');

		expect(userPrompt).toContain('Translate the provided CV HTML to English only.');
		expect(userPrompt).toContain('Preserve the exact HTML structure');
		expect(userPrompt).toContain('<source_cv_html>');
		expect(userPrompt).toContain('<section><p>Hola mundo</p></section>');
	});
});

describe('extractChatCompletionText', () => {
	it('devuelve cadena vacia cuando el proveedor responde sin choices', () => {
		expect(
			extractChatCompletionText({
				id: 'chatcmpl-missing-choices',
				object: 'chat.completion',
				created: 0,
				model: 'openrouter/test',
				usage: {
					prompt_tokens: 1,
					completion_tokens: 0,
					total_tokens: 1
				}
			} as never)
		).toBe('');
	});
});
