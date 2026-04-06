import { describe, expect, it } from 'vitest';

import { AiProviderRequestError } from '../ai-provider-errors';
import {
	classifyPdfNativeFailure,
	decidePdfTextFallback
} from './pdf-native-provider-fallback';

describe('classifyPdfNativeFailure', () => {
	it('reconoce errores explicitos de credits/files', () => {
		expect(
			classifyPdfNativeFailure({
				message: 'Insufficient credits to process PDF files with the file parser plugin.'
			})
		).toBe('files-quota');
	});

	it('reconoce errores explicitos de soporte de archivos', () => {
		expect(
			classifyPdfNativeFailure({
				message: 'This model does not support PDF attachments.'
			})
		).toBe('files-unsupported');
	});

	it('no clasifica errores genericos no relacionados con files', () => {
		expect(
			classifyPdfNativeFailure({
				message: 'The provider is temporarily overloaded.'
			})
		).toBeNull();
	});
});

describe('decidePdfTextFallback', () => {
	it('habilita fallback cuando el kind ya fue clasificado como PDF/files', () => {
		const decision = decidePdfTextFallback(
			new AiProviderRequestError(
				'The files endpoint is disabled for this API key.',
				undefined,
				'pdf-native-files-endpoint-unavailable'
			)
		);

		expect(decision.shouldFallback).toBe(true);
		expect(decision.category).toBe('files-endpoint-unavailable');
	});

	it('bloquea fallback para errores no relacionados con files', () => {
		const decision = decidePdfTextFallback(
			new AiProviderRequestError(
				'El modelo configurado no existe o no es compatible con OpenRouter. Revisa AI_PROVIDER_MODEL.',
				undefined,
				'unsupported-model'
			)
		);

		expect(decision.shouldFallback).toBe(false);
	});
});
