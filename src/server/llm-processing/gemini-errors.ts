import { AiProviderRequestError } from './ai-provider-errors';

/**
 * Error used for Gemini-specific request failures while preserving the shared AI provider shape.
 */
export class GeminiRequestError extends AiProviderRequestError {
	constructor(message: string, cause?: unknown) {
		super(message, cause);
		this.name = 'GeminiRequestError';
	}
}
