import { describe, expect, it, vi } from 'vitest';

import { AiProviderRequestError } from './ai-provider-errors';
import { executeOpenAiCompatibleChatText } from './ai-provider-openai-compatible-client';

describe('executeOpenAiCompatibleChatText', () => {
	it('convierte una respuesta sin choices en un error util de respuesta vacia', async () => {
		const client = {
			chat: {
				completions: {
					create: vi.fn().mockResolvedValue({
						id: 'chatcmpl-missing-choices',
						object: 'chat.completion',
						created: 0,
						model: 'openrouter/test',
						usage: {
							prompt_tokens: 1,
							completion_tokens: 0,
							total_tokens: 1
						}
					})
				}
			}
		};

		await expect(
			executeOpenAiCompatibleChatText({
				client: client as never,
				provider: 'openrouter',
				request: {
					model: 'openrouter/test',
					messages: [{ role: 'user', content: 'hola' }]
				},
				emptyResponseMessage: 'La IA no devolvio contenido util.',
				fallbackErrorMessage: 'No se pudo procesar la solicitud con el proveedor de IA.'
			})
		).rejects.toEqual(
			expect.objectContaining<Partial<AiProviderRequestError>>({
				name: 'AiProviderRequestError',
				message: 'La IA no devolvio contenido util.'
			})
		);
	});
});
