import { beforeEach, describe, expect, it, vi } from 'vitest';

const { aiProviderMocks } = vi.hoisted(() => {
	return {
		aiProviderMocks: {
			translateCvToEnglish: vi.fn(),
			getConfiguredModels: vi.fn()
		}
	};
});

vi.mock('../../server/llm-processing/ai-provider-service', async () => {
	const actualErrors = await vi.importActual<
		typeof import('../../server/llm-processing/ai-provider-errors')
	>('../../server/llm-processing/ai-provider-errors');

	return {
		...actualErrors,
		aiProvider: aiProviderMocks
	};
});

import { AiProviderRequestError } from '../../server/llm-processing/ai-provider-errors';
import { POST } from './translate';

const callPost = async (request: Request): Promise<Response> => {
	return POST({ request } as Parameters<typeof POST>[0]);
};

beforeEach(() => {
	aiProviderMocks.translateCvToEnglish.mockReset();
	aiProviderMocks.getConfiguredModels.mockReset();
});

describe('translate API', () => {
	it('mantiene la forma del payload en exito', async () => {
		aiProviderMocks.translateCvToEnglish.mockResolvedValue('<section><p>Hello world</p></section>');
		aiProviderMocks.getConfiguredModels.mockReturnValue({
			processingModel: 'gpt-4o-mini',
			generationModel: 'gpt-4o-mini',
			translationModel: 'gpt-4o-mini'
		});

		const response = await callPost(
			new Request('http://localhost/api/translate', {
				method: 'POST',
				headers: {
					'content-type': 'application/json; charset=utf-8'
				},
				body: JSON.stringify({
					optimizedHTML: '<section><p>Hola mundo</p></section>'
				})
			})
		);
		const payload = (await response.json()) as {
			ok: boolean;
			data: {
				translatedHTML: string;
				models: {
					translationModel: string;
				};
			};
		};

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.data.translatedHTML).toBe('<section><p>Hello world</p></section>');
		expect(payload.data.models.translationModel).toBe('gpt-4o-mini');
	});

	it('mapea cuota agotada a AI_QUOTA_EXHAUSTED', async () => {
		aiProviderMocks.translateCvToEnglish.mockRejectedValue(
			new AiProviderRequestError(
				'Se excedio la cuota del proveedor de IA.',
				undefined,
				'quota-exhausted'
			)
		);

		const response = await callPost(
			new Request('http://localhost/api/translate', {
				method: 'POST',
				headers: {
					'content-type': 'application/json; charset=utf-8'
				},
				body: JSON.stringify({
					optimizedHTML: '<section><p>Hola mundo</p></section>'
				})
			})
		);
		const payload = (await response.json()) as {
			ok: false;
			error: {
				code: string;
			};
		};

		expect(response.status).toBe(429);
		expect(payload.error.code).toBe('AI_QUOTA_EXHAUSTED');
	});
});
