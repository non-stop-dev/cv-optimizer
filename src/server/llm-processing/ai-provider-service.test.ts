import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { AiProviderRequestError } from './ai-provider-errors';
import { AiProviderService } from './ai-provider-service';
import type { AiProviderRuntimeConfig } from './ai-provider-types';

const createRuntimeConfig = (
	provider: AiProviderRuntimeConfig['provider']
): AiProviderRuntimeConfig => {
	return {
		codingEnvironment: 'development',
		provider,
		apiKey: 'test-key',
		baseURL:
			provider === 'openai'
				? 'https://api.openai.com/v1'
				: provider === 'gemini'
					? 'https://generativelanguage.googleapis.com/v1beta/openai/'
					: 'https://openrouter.ai/api/v1',
		model: provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
		maxOutputTokens: 4096,
		temperature: 1,
		topP: 0.95,
		defaultHeaders: provider === 'openrouter' ? { 'X-Title': 'CV Optimizer' } : {}
	};
};

describe('AiProviderService', () => {
	it('usa el camino OpenAI-compatible para texto y traduccion', async () => {
		const executeOpenAiCompatibleChat = vi
			.fn()
			.mockResolvedValue({ choices: [{ message: { content: '<section>ok</section>' } }], usage: {} });
		const service = new AiProviderService(createRuntimeConfig('openai'), {
			createOpenAiClient: () => ({}) as OpenAI,
			executeOpenAiCompatibleChat
		});

		const optimizedHtml = await service.optimizeCV({
			content: 'Experiencia: Analista de datos'
		});
		const translatedHtml = await service.translateCvToEnglish('<section><p>Hola</p></section>');

		expect(optimizedHtml).toBe('<section>ok</section>');
		expect(translatedHtml).toBe('<section>ok</section>');
		expect(executeOpenAiCompatibleChat).toHaveBeenCalledTimes(2);
	});

	it('usa el flujo PDF nativo de Gemini cuando el proveedor es gemini', async () => {
		const executeOpenAiCompatibleChat = vi.fn();
		const optimizeCvWithGeminiNativePdf = vi.fn().mockResolvedValue('<section>gemini pdf</section>');
		const service = new AiProviderService(createRuntimeConfig('gemini'), {
			createOpenAiClient: () => ({}) as OpenAI,
			executeOpenAiCompatibleChat,
			optimizeCvWithGeminiNativePdf
		});

		const pdfFile = new File(['%PDF-1.4 fake content'], 'cv.pdf', {
			type: 'application/pdf'
		});

		const optimizedHtml = await service.optimizeCV({
			content: '[PDF_NATIVE_PROVIDER_INPUT]',
			sourceDocument: {
				file: pdfFile,
				mimeType: 'application/pdf',
				format: 'pdf'
			}
		});

		expect(optimizedHtml).toBe('<section>gemini pdf</section>');
		expect(optimizeCvWithGeminiNativePdf).toHaveBeenCalledTimes(1);
		expect(executeOpenAiCompatibleChat).not.toHaveBeenCalled();
	});

	it('falla ante modelo no soportado sin intentar fallback alterno', async () => {
		const executeOpenAiCompatibleChat = vi
			.fn()
			.mockRejectedValue(
				new AiProviderRequestError(
					'El modelo configurado no existe o no es compatible con OpenRouter. Revisa AI_PROVIDER_MODEL.',
					undefined,
					'unsupported-model'
				)
			);
		const optimizeCvWithGeminiNativePdf = vi.fn();
		const service = new AiProviderService(createRuntimeConfig('openrouter'), {
			createOpenAiClient: () => ({}) as OpenAI,
			executeOpenAiCompatibleChat,
			optimizeCvWithGeminiNativePdf
		});

		const pdfFile = new File(['%PDF-1.4 fake content'], 'cv.pdf', {
			type: 'application/pdf'
		});

		await expect(
			service.optimizeCV({
				content: '[PDF_NATIVE_PROVIDER_INPUT]',
				sourceDocument: {
					file: pdfFile,
					mimeType: 'application/pdf',
					format: 'pdf'
				}
			})
		).rejects.toThrow('AI_PROVIDER_MODEL');

		expect(executeOpenAiCompatibleChat).toHaveBeenCalledTimes(1);
		expect(optimizeCvWithGeminiNativePdf).not.toHaveBeenCalled();
	});
});
