import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';

import { AiProviderRequestError } from './ai-provider-errors';
import { AiProviderService } from './ai-provider-service';
import type { AiProviderRuntimeConfig } from './ai-provider-types';
import { createPdfFileFixture } from './pdf-processing/pdf-test-fixtures';

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

		expect(optimizedHtml).toEqual({
			optimizedHtml: '<section>ok</section>',
			processing: {
				mode: 'text-direct',
				notice: 'Documento procesado con el proveedor configurado.'
			}
		});
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

		expect(optimizedHtml).toEqual({
			optimizedHtml: '<section>gemini pdf</section>',
			processing: {
				mode: 'pdf-native-input',
				notice: 'PDF procesado con soporte nativo del proveedor.'
			}
		});
		expect(optimizeCvWithGeminiNativePdf).toHaveBeenCalledTimes(1);
		expect(executeOpenAiCompatibleChat).not.toHaveBeenCalled();
	});

	it('hace fallback a texto cuando el proveedor rechaza files PDF', async () => {
		const executeOpenAiCompatibleChat = vi
			.fn()
			.mockRejectedValueOnce(
				new AiProviderRequestError(
					'This model does not support PDF attachments.',
					undefined,
					'pdf-native-files-unsupported'
				)
			)
			.mockResolvedValueOnce({
				choices: [{ message: { content: '<section>fallback ok</section>' } }],
				usage: {}
			});
		const service = new AiProviderService(createRuntimeConfig('openrouter'), {
			createOpenAiClient: () => ({}) as OpenAI,
			executeOpenAiCompatibleChat
		});

		const pdfFile = createPdfFileFixture([
			[
				'Laura Perez',
				'Ingeniera de datos con experiencia en SQL, Python y ETL.',
				'Logros: automatizacion de reportes, validacion de calidad, modelado de datos y reduccion de tiempos operativos.'
			].join('\n'),
			[
				'Experiencia',
				'Senior Data Engineer | Empresa Dos | 2021-2026',
				'Disene pipelines, modele datos, coordine entregas con analytics y documente procesos criticos para negocio.'
			].join('\n')
		]);

		const optimizedHtml = await service.optimizeCV({
			content: '[PDF_NATIVE_PROVIDER_INPUT]',
			sourceDocument: {
				file: pdfFile,
				mimeType: 'application/pdf',
				format: 'pdf'
			}
		});

		expect(optimizedHtml.processing.mode).toBe('pdf-text-fallback');
		expect(optimizedHtml.optimizedHtml).toBe('<section>fallback ok</section>');
		expect(executeOpenAiCompatibleChat).toHaveBeenCalledTimes(2);
		expect(
			Array.isArray(executeOpenAiCompatibleChat.mock.calls[0]?.[0]?.request.messages[1]?.content)
		).toBe(true);
		expect(
			typeof executeOpenAiCompatibleChat.mock.calls[1]?.[0]?.request.messages[1]?.content
		).toBe('string');
	});

	it('bloquea el fallback cuando la extraccion del PDF es insuficiente', async () => {
		const executeOpenAiCompatibleChat = vi
			.fn()
			.mockRejectedValue(
				new AiProviderRequestError(
					'Insufficient credits to process PDF files.',
					undefined,
					'pdf-native-files-quota-exhausted'
				)
			);
		const service = new AiProviderService(createRuntimeConfig('openrouter'), {
			createOpenAiClient: () => ({}) as OpenAI,
			executeOpenAiCompatibleChat
		});

		const pdfFile = createPdfFileFixture(['CV', 'OK']);

		await expect(
			service.optimizeCV({
				content: '[PDF_NATIVE_PROVIDER_INPUT]',
				sourceDocument: {
					file: pdfFile,
					mimeType: 'application/pdf',
					format: 'pdf'
				}
			})
		).rejects.toMatchObject({
			name: 'AiProviderRequestError',
			kind: 'pdf-text-extraction-insufficient'
		});

		expect(executeOpenAiCompatibleChat).toHaveBeenCalledTimes(1);
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
