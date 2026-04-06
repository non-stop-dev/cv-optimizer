import OpenAI from 'openai';
import type {
	ChatCompletion,
	ChatCompletionCreateParamsNonStreaming
} from 'openai/resources/chat/completions/completions';

import { mapOpenAiCompatibleError } from './ai-provider-error-mapper';
import { AiProviderRequestError } from './ai-provider-errors';
import type { AiProviderRuntimeConfig, SupportedAiProvider } from './ai-provider-types';
import { extractChatCompletionText } from './ai-provider-openai-compatible-request';

/**
 * Creates the shared OpenAI-compatible SDK client for OpenAI, Gemini, and OpenRouter.
 */
export const createOpenAiCompatibleClient = (config: AiProviderRuntimeConfig): OpenAI => {
	return new OpenAI({
		apiKey: config.apiKey,
		baseURL: config.baseURL,
		defaultHeaders: config.defaultHeaders
	});
};

/**
 * Executes a shared chat completion request and extracts plain text output.
 */
export const executeOpenAiCompatibleChatText = async ({
	client,
	provider,
	request,
	emptyResponseMessage,
	fallbackErrorMessage
}: {
	client: OpenAI;
	provider: SupportedAiProvider;
	request: ChatCompletionCreateParamsNonStreaming;
	emptyResponseMessage: string;
	fallbackErrorMessage: string;
}): Promise<ChatCompletion> => {
	try {
		const completion = await client.chat.completions.create(request);
		const text = extractChatCompletionText(completion);
		if (!text) {
			throw new AiProviderRequestError(emptyResponseMessage);
		}

		return completion;
	} catch (error) {
		if (error instanceof AiProviderRequestError) {
			throw error;
		}

		return mapOpenAiCompatibleError(provider, error, fallbackErrorMessage);
	}
};
