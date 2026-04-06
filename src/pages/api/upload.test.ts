import { beforeEach, describe, expect, it, vi } from 'vitest';

const { aiProviderMocks, sanitizeUploadedDocumentMock } = vi.hoisted(() => {
	return {
		aiProviderMocks: {
			optimizeCV: vi.fn(),
			getConfiguredModels: vi.fn()
		},
		sanitizeUploadedDocumentMock: vi.fn()
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

vi.mock('../../server/llm-processing/upload/sanitizeUploadedDocument', () => ({
	sanitizeUploadedDocument: sanitizeUploadedDocumentMock
}));

import {
	AiProviderConfigurationError
} from '../../server/llm-processing/ai-provider-errors';
import { POST } from './upload';

const callPost = async (request: Request): Promise<Response> => {
	return POST({ request } as Parameters<typeof POST>[0]);
};

beforeEach(() => {
	aiProviderMocks.optimizeCV.mockReset();
	aiProviderMocks.getConfiguredModels.mockReset();
	sanitizeUploadedDocumentMock.mockReset();
});

describe('upload API', () => {
	it('mantiene la forma del payload en exito', async () => {
		aiProviderMocks.optimizeCV.mockResolvedValue('<section><p>Optimizado</p></section>');
		aiProviderMocks.getConfiguredModels.mockReturnValue({
			processingModel: 'gpt-4o-mini',
			generationModel: 'gpt-4o-mini',
			translationModel: 'gpt-4o-mini'
		});
		sanitizeUploadedDocumentMock.mockResolvedValue({
			format: 'txt',
			originalFileName: 'resume.txt',
			safeFileName: 'resume.txt',
			mimeType: 'text/plain',
			sizeInBytes: 120,
			sanitizedContent: 'Contenido sanitizado',
			summary: 'TXT sanitizado',
			contentHash: 'hash-123',
			targetPositions: ['Data Analyst']
		});

		const formData = new FormData();
		formData.append('document', new File(['resume'], 'resume.txt', { type: 'text/plain' }));
		formData.append('targetPositions', JSON.stringify(['Data Analyst']));

		const response = await callPost(
			new Request('http://localhost/api/upload', {
				method: 'POST',
				body: formData
			})
		);
		const payload = (await response.json()) as {
			ok: boolean;
			data: {
				optimizedHTML: string;
				models: {
					processingModel: string;
					generationModel: string;
					translationModel: string;
				};
			};
		};

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.data.optimizedHTML).toBe('<section><p>Optimizado</p></section>');
		expect(payload.data.models).toEqual({
			processingModel: 'gpt-4o-mini',
			generationModel: 'gpt-4o-mini',
			translationModel: 'gpt-4o-mini'
		});
		expect(aiProviderMocks.optimizeCV).toHaveBeenCalledWith(
			expect.objectContaining({
				content: 'Contenido sanitizado',
				targetPositions: ['Data Analyst']
			})
		);
	});

	it('mapea error de configuracion a AI_NOT_CONFIGURED', async () => {
		aiProviderMocks.optimizeCV.mockRejectedValue(
			new AiProviderConfigurationError('AI_PROVIDER no configurado')
		);
		sanitizeUploadedDocumentMock.mockResolvedValue({
			format: 'txt',
			originalFileName: 'resume.txt',
			safeFileName: 'resume.txt',
			mimeType: 'text/plain',
			sizeInBytes: 120,
			sanitizedContent: 'Contenido sanitizado',
			summary: 'TXT sanitizado',
			contentHash: 'hash-123',
			targetPositions: []
		});

		const formData = new FormData();
		formData.append('document', new File(['resume'], 'resume.txt', { type: 'text/plain' }));
		formData.append('targetPositions', JSON.stringify([]));

		const response = await callPost(
			new Request('http://localhost/api/upload', {
				method: 'POST',
				body: formData
			})
		);
		const payload = (await response.json()) as {
			ok: false;
			error: {
				code: string;
			};
		};

		expect(response.status).toBe(503);
		expect(payload.error.code).toBe('AI_NOT_CONFIGURED');
	});
});
