import { afterEach, describe, expect, it } from 'vitest';

import {
	AI_PROVIDER_DEFAULT_BASE_URLS,
	resolveAiProviderRuntimeConfig
} from './ai-provider-config';

const ENV_KEYS = [
	'AI_PROVIDER',
	'AI_PROVIDER_API_KEY',
	'AI_PROVIDER_MODEL',
	'AI_PROVIDER_BASE_URL',
	'AI_TEMPERATURE',
	'AI_MAX_OUTPUT_TOKENS',
	'AI_TOP_P',
	'AI_OPENROUTER_HTTP_REFERER',
	'AI_OPENROUTER_TITLE',
	'CODING_ENVIRONMENT'
] as const;

const ORIGINAL_ENV = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

const restoreEnvironment = (): void => {
	for (const key of ENV_KEYS) {
		const originalValue = ORIGINAL_ENV[key];
		if (originalValue === undefined) {
			delete process.env[key];
			continue;
		}

		process.env[key] = originalValue;
	}
};

afterEach(() => {
	restoreEnvironment();
});

describe('resolveAiProviderRuntimeConfig', () => {
	it('resuelve OpenAI con base URL por defecto', () => {
		process.env.AI_PROVIDER = 'openai';
		process.env.AI_PROVIDER_API_KEY = 'test-openai-key';
		process.env.AI_PROVIDER_MODEL = 'gpt-4o-mini';

		const config = resolveAiProviderRuntimeConfig();

		expect(config.provider).toBe('openai');
		expect(config.baseURL).toBe(AI_PROVIDER_DEFAULT_BASE_URLS.openai);
		expect(config.model).toBe('gpt-4o-mini');
	});

	it('resuelve Gemini con base URL por defecto', () => {
		process.env.AI_PROVIDER = 'gemini';
		process.env.AI_PROVIDER_API_KEY = 'test-gemini-key';
		process.env.AI_PROVIDER_MODEL = 'gemini-2.5-flash';

		const config = resolveAiProviderRuntimeConfig();

		expect(config.provider).toBe('gemini');
		expect(config.baseURL).toBe(AI_PROVIDER_DEFAULT_BASE_URLS.gemini);
	});

	it('incluye los headers opcionales de OpenRouter', () => {
		process.env.AI_PROVIDER = 'openrouter';
		process.env.AI_PROVIDER_API_KEY = 'test-openrouter-key';
		process.env.AI_PROVIDER_MODEL = 'openai/gpt-4o-mini';
		process.env.AI_OPENROUTER_HTTP_REFERER = 'https://example.com';
		process.env.AI_OPENROUTER_TITLE = 'CV Optimizer';

		const config = resolveAiProviderRuntimeConfig();

		expect(config.provider).toBe('openrouter');
		expect(config.baseURL).toBe(AI_PROVIDER_DEFAULT_BASE_URLS.openrouter);
		expect(config.defaultHeaders).toEqual({
			'HTTP-Referer': 'https://example.com',
			'X-Title': 'CV Optimizer'
		});
	});

	it('falla cuando falta AI_PROVIDER_API_KEY', () => {
		process.env.AI_PROVIDER = 'openai';
		delete process.env.AI_PROVIDER_API_KEY;
		process.env.AI_PROVIDER_MODEL = 'gpt-4o-mini';

		expect(() => resolveAiProviderRuntimeConfig()).toThrow('AI_PROVIDER_API_KEY no configurada');
	});

	it('falla cuando el proveedor no es valido', () => {
		process.env.AI_PROVIDER = 'anthropic';
		process.env.AI_PROVIDER_API_KEY = 'test-key';
		process.env.AI_PROVIDER_MODEL = 'claude';

		expect(() => resolveAiProviderRuntimeConfig()).toThrow('AI_PROVIDER="anthropic" no es valido');
	});
});
