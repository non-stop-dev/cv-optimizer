import {
	AiProviderConfigurationError,
	AiProviderRequestError
} from '../ai-provider-errors';
import type { AiSourceDocument } from '../ai-provider-types';
import { decidePdfTextFallback } from './pdf-native-provider-fallback';
import type { OptimizeCvResult } from './pdf-processing-types';
import { extractTextFromPdf } from './pdf-text-extraction';
import {
	assessPdfTextExtractionQuality,
	PDF_TEXT_EXTRACTION_INSUFFICIENT_MESSAGE
} from './pdf-text-quality';

interface OptimizePdfWithNativeFallbackParams {
	sourceDocument: AiSourceDocument;
	logDevelopment: (title: string, payload: string) => void;
	nativePdfAttempt: () => Promise<string>;
	textFallbackAttempt: (extractedText: string) => Promise<string>;
}

const PDF_NATIVE_SUCCESS_NOTICE =
	'PDF procesado con soporte nativo del proveedor.';
const PDF_TEXT_FALLBACK_NOTICE =
	'El proveedor no pudo procesar el PDF de forma nativa. Se uso una extracción validada de texto como fallback.';

const toPdfTextExtractionFailure = (cause: unknown): AiProviderRequestError => {
	return new AiProviderRequestError(
		PDF_TEXT_EXTRACTION_INSUFFICIENT_MESSAGE,
		cause,
		'pdf-text-extraction-insufficient'
	);
};

/**
 * Orchestrates native PDF input first and falls back to validated extracted
 * text only for explicit file/PDF-related provider failures.
 */
export const optimizePdfWithNativeFallback = async ({
	sourceDocument,
	logDevelopment,
	nativePdfAttempt,
	textFallbackAttempt
}: OptimizePdfWithNativeFallbackParams): Promise<OptimizeCvResult> => {
	logDevelopment(
		'PDF native input attempt',
		JSON.stringify(
			{
				fileName: sourceDocument.file.name,
				mimeType: sourceDocument.mimeType,
				sizeInBytes: sourceDocument.file.size
			},
			null,
			2
		)
	);

	try {
		const optimizedHtml = await nativePdfAttempt();
		logDevelopment('PDF native input result', 'El proveedor proceso el PDF de forma nativa.');
		return {
			optimizedHtml,
			processing: {
				mode: 'pdf-native-input',
				notice: PDF_NATIVE_SUCCESS_NOTICE
			}
		};
	} catch (error) {
		if (error instanceof AiProviderConfigurationError) {
			throw error;
		}

		const decision = decidePdfTextFallback(error);
		logDevelopment(
			'PDF native input failure',
			JSON.stringify(
				{
					errorName: error instanceof Error ? error.name : 'UnknownError',
					errorMessage: error instanceof Error ? error.message : String(error),
					shouldFallback: decision.shouldFallback,
					category: decision.category,
					reason: decision.reason
				},
				null,
				2
			)
		);

		if (!decision.shouldFallback) {
			throw error;
		}

		logDevelopment(
			'PDF text fallback activation',
			'Se intentara extraer texto del PDF y validar su calidad antes de reintentar.'
		);

		let extractedText: string;
		let extractionAssessmentMessage = '';

		try {
			const pdfBytes = new Uint8Array(await sourceDocument.file.arrayBuffer());
			const extraction = await extractTextFromPdf(pdfBytes);
			const qualityAssessment = assessPdfTextExtractionQuality(extraction.metrics);

			logDevelopment(
				'PDF text extraction metrics',
				JSON.stringify(
					{
						pageCount: extraction.metrics.pageCount,
						totalChars: extraction.metrics.totalChars,
						totalNonWhitespaceChars:
							extraction.metrics.totalNonWhitespaceChars,
						emptyPageCount: extraction.metrics.emptyPageCount,
						charsPerNonEmptyPage:
							extraction.metrics.charsPerNonEmptyPage,
						printableCharRatio:
							extraction.metrics.printableCharRatio,
						passedQualityChecks: qualityAssessment.isAcceptable,
						failureReasons: qualityAssessment.failureReasons
					},
					null,
					2
				)
			);

			if (!qualityAssessment.isAcceptable) {
				extractionAssessmentMessage = qualityAssessment.failureReasons.join(' | ');
				throw toPdfTextExtractionFailure(qualityAssessment);
			}

			extractedText = extraction.text;
		} catch (fallbackError) {
			if (
				fallbackError instanceof AiProviderRequestError &&
				fallbackError.kind === 'pdf-text-extraction-insufficient'
			) {
				throw fallbackError;
			}

			logDevelopment(
				'PDF text fallback failure',
				extractionAssessmentMessage ||
					(fallbackError instanceof Error
						? fallbackError.message
						: 'No se pudo extraer texto confiable del PDF.')
			);
			throw toPdfTextExtractionFailure(fallbackError);
		}

		const optimizedHtml = await textFallbackAttempt(extractedText);
		logDevelopment(
			'PDF text fallback result',
			'El proveedor completo el procesamiento usando el texto extraido y validado.'
		);

		return {
			optimizedHtml,
			processing: {
				mode: 'pdf-text-fallback',
				notice: PDF_TEXT_FALLBACK_NOTICE,
				nativeFailureReason: decision.reason
			}
		};
	}
};
