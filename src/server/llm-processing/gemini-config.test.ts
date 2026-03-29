import { HarmBlockThreshold, ThinkingLevel } from '@google/genai';
import { afterEach, describe, expect, it } from 'vitest';

import {
	buildGenerationConfig,
	resolveGeminiRuntimeConfig,
	type GeminiRuntimeConfig,
	type GeminiSafetyMode
} from './gemini-config'; 

const ORIGINAL_CODING_ENVIRONMENT = process.env.CODING_ENVIRONMENT;
const ORIGINAL_AI_SAFETY_MODE = process.env.AI_SAFETY_MODE;

const restoreEnvironment = (): void => {
	if (ORIGINAL_CODING_ENVIRONMENT === undefined) {
		delete process.env.CODING_ENVIRONMENT;
	} else {
		process.env.CODING_ENVIRONMENT = ORIGINAL_CODING_ENVIRONMENT;
	}

	if (ORIGINAL_AI_SAFETY_MODE === undefined) {
		delete process.env.AI_SAFETY_MODE;
	} else {
		process.env.AI_SAFETY_MODE = ORIGINAL_AI_SAFETY_MODE;
	}
};

afterEach(() => {
	restoreEnvironment();
});

const createRuntimeConfig = (safetyMode: GeminiSafetyMode): GeminiRuntimeConfig => {
	return {
		codingEnvironment: 'production',
		processingModelName: 'processing-model',
		generationModelName: 'generation-model',
		maxOutputTokens: 4096,
		temperature: 1,
		topP: 0.95,
		thinkingLevel: ThinkingLevel.LOW,
		safetyMode,
		enableGoogleSearchTool: false,
		apiKey: 'test-key'
	};
};

describe('resolveGeminiRuntimeConfig safety mode defaults', () => {
	it('usa strict por defecto en production', () => {
		delete process.env.CODING_ENVIRONMENT;
		delete process.env.AI_SAFETY_MODE;

		const config = resolveGeminiRuntimeConfig();

		expect(config.codingEnvironment).toBe('production');
		expect(config.safetyMode).toBe('strict');
	});

	it('usa relaxed por defecto en development', () => {
		process.env.CODING_ENVIRONMENT = 'development';
		delete process.env.AI_SAFETY_MODE;

		const config = resolveGeminiRuntimeConfig();

		expect(config.codingEnvironment).toBe('development');
		expect(config.safetyMode).toBe('relaxed');
	});

	it('permite override explicito con AI_SAFETY_MODE', () => {
		process.env.CODING_ENVIRONMENT = 'production';
		process.env.AI_SAFETY_MODE = 'off';

		const config = resolveGeminiRuntimeConfig();

		expect(config.safetyMode).toBe('off');
	});
});

describe('buildGenerationConfig safety thresholds', () => {
	it('aplica BLOCK_LOW_AND_ABOVE en strict', () => {
		const generationConfig = buildGenerationConfig(createRuntimeConfig('strict'));
		const safetySettings = generationConfig.safetySettings ?? [];

		expect(safetySettings.length).toBeGreaterThan(0);
		for (const setting of safetySettings) {
			expect(setting.threshold).toBe(HarmBlockThreshold.BLOCK_LOW_AND_ABOVE);
		}
	});

	it('aplica BLOCK_ONLY_HIGH en relaxed', () => {
		const generationConfig = buildGenerationConfig(createRuntimeConfig('relaxed'));
		const safetySettings = generationConfig.safetySettings ?? [];

		expect(safetySettings.length).toBeGreaterThan(0);
		for (const setting of safetySettings) {
			expect(setting.threshold).toBe(HarmBlockThreshold.BLOCK_ONLY_HIGH);
		}
	});

	it('aplica OFF solo cuando se configura explicitamente off', () => {
		const generationConfig = buildGenerationConfig(createRuntimeConfig('off'));
		const safetySettings = generationConfig.safetySettings ?? [];

		expect(safetySettings.length).toBeGreaterThan(0);
		for (const setting of safetySettings) {
			expect(setting.threshold).toBe(HarmBlockThreshold.OFF);
		}
	});
});
