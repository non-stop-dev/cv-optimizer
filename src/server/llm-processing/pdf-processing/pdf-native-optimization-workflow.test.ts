import { describe, expect, it, vi } from 'vitest';

import { AiProviderRequestError } from '../ai-provider-errors';
import { createPdfFileFixture } from './pdf-test-fixtures';
import { optimizePdfWithNativeFallback } from './pdf-native-optimization-workflow';

const createPdfSourceDocument = (pages: string[]) => ({
	file: createPdfFileFixture(pages),
	mimeType: 'application/pdf',
	format: 'pdf' as const
});

describe('optimizePdfWithNativeFallback', () => {
	it('retorna exito inmediato cuando el procesamiento PDF nativo funciona', async () => {
		const result = await optimizePdfWithNativeFallback({
			sourceDocument: createPdfSourceDocument([
				'CV de prueba con suficiente texto para no activar heuristicas.'
			]),
			logDevelopment: vi.fn(),
			nativePdfAttempt: vi.fn().mockResolvedValue('<section>native</section>'),
			textFallbackAttempt: vi.fn()
		});

		expect(result).toEqual({
			optimizedHtml: '<section>native</section>',
			processing: {
				mode: 'pdf-native-input',
				notice: 'PDF procesado con soporte nativo del proveedor.'
			}
		});
	});

	it('hace fallback a texto validado cuando el proveedor rechaza files PDF', async () => {
		const textFallbackAttempt = vi
			.fn()
			.mockResolvedValue('<section>fallback</section>');

		const result = await optimizePdfWithNativeFallback({
			sourceDocument: createPdfSourceDocument([
				[
					'Laura Perez',
					'Ingeniera de datos con experiencia en SQL, Python y pipelines ETL.',
					'Trabajo reciente: optimizacion de reportes, automatizacion de cargas y control de calidad.'
				].join('\n'),
				[
					'Experiencia',
					'Senior Data Engineer | Empresa Dos | 2021-2026',
					'Disene jobs, modele datos y coordine despliegues con analytics y producto.'
				].join('\n')
			]),
			logDevelopment: vi.fn(),
			nativePdfAttempt: vi
				.fn()
				.mockRejectedValue(
					new AiProviderRequestError(
						'This model does not support PDF attachments.',
						undefined,
						'pdf-native-files-unsupported'
					)
				),
			textFallbackAttempt
		});

		expect(result.processing.mode).toBe('pdf-text-fallback');
		expect(result.processing.nativeFailureReason).toContain('does not support PDF attachments');
		expect(textFallbackAttempt).toHaveBeenCalledTimes(1);
		expect(textFallbackAttempt.mock.calls[0]?.[0]).toContain('Laura Perez');
		expect(textFallbackAttempt.mock.calls[0]?.[0]).toContain(
			'Senior Data Engineer | Empresa Dos | 2021-2026'
		);
	});

	it('bloquea el fallback cuando la extraccion es insuficiente', async () => {
		await expect(
			optimizePdfWithNativeFallback({
				sourceDocument: createPdfSourceDocument(['CV', 'OK']),
				logDevelopment: vi.fn(),
				nativePdfAttempt: vi
					.fn()
					.mockRejectedValue(
						new AiProviderRequestError(
							'Insufficient credits to process PDF files.',
							undefined,
							'pdf-native-files-quota-exhausted'
						)
					),
				textFallbackAttempt: vi.fn()
			})
		).rejects.toMatchObject({
			name: 'AiProviderRequestError',
			kind: 'pdf-text-extraction-insufficient'
		});
	});

	it('no hace fallback para errores no relacionados con files', async () => {
		const providerError = new AiProviderRequestError(
			'El proveedor esta saturado temporalmente.',
			undefined,
			'provider-overloaded'
		);

		await expect(
			optimizePdfWithNativeFallback({
				sourceDocument: createPdfSourceDocument([
					'Texto suficiente para evitar ruido en el caso negativo.'
				]),
				logDevelopment: vi.fn(),
				nativePdfAttempt: vi.fn().mockRejectedValue(providerError),
				textFallbackAttempt: vi.fn()
			})
		).rejects.toBe(providerError);
	});
});
