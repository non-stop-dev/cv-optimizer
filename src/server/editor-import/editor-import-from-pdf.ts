import { createHash } from 'node:crypto';

import { extractTextFromPdf } from '../llm-processing/pdf-processing/pdf-text-extraction';
import {
	PDF_TEXT_EXTRACTION_INSUFFICIENT_MESSAGE,
	assessPdfTextExtractionQuality
} from '../llm-processing/pdf-processing/pdf-text-quality';
import { UploadSanitizationError } from '../llm-processing/upload/errors';
import { sanitizePdfDocument } from '../llm-processing/upload/sanitizers/pdf';
import { extractPrintableEditablePayload } from '../export-cv/cv-printable-editable-payload';
import type { EditorImportResult } from './editor-import-types';
import { buildEditorHtmlFromPdfText } from './editor-import-pdf-html';
import { assertEditorImportIsAllowed } from './editor-import-validation';

/**
 * Validates a PDF, extracts readable text, and reconstructs a semantic HTML
 * draft suitable for the editor without involving the AI pipeline.
 */
export const importPdfDocumentToEditor = async (
	file: File
): Promise<EditorImportResult> => {
	try {
		const context = assertEditorImportIsAllowed(file);
		if (context.format !== 'pdf') {
			throw new UploadSanitizationError({
				code: 'UNSUPPORTED_EXTENSION',
				statusCode: 415,
				message: 'La importacion PDF directa requiere un archivo .pdf valido.'
			});
		}

		const sourcePdfBytes = Uint8Array.from(new Uint8Array(await file.arrayBuffer()));
		await sanitizePdfDocument(Uint8Array.from(sourcePdfBytes));

		const extractionResult = await extractTextFromPdf(Uint8Array.from(sourcePdfBytes));
		const embeddedEditablePayload = extractPrintableEditablePayload(extractionResult.text);
		if (embeddedEditablePayload) {
			return {
				format: 'pdf',
				safeFileName: context.safeFileName,
				sizeInBytes: context.sizeInBytes,
				summary: 'PDF reabierto desde la carga editable embebida por el exportador.',
				contentHash: createHash('sha256').update(sourcePdfBytes).digest('hex'),
				optimizedHTML: embeddedEditablePayload.optimizedHTML,
				importMode: 'pdf-embedded-editable',
				importNotice:
					'Se recupero el HTML original embebido en el PDF exportado por CV Optimizer.'
			};
		}

		const textQuality = assessPdfTextExtractionQuality(extractionResult.metrics);
		if (!textQuality.isAcceptable) {
			throw new UploadSanitizationError({
				code: 'PARSE_ERROR',
				statusCode: 422,
				message: PDF_TEXT_EXTRACTION_INSUFFICIENT_MESSAGE
			});
		}

		const rebuiltHtml = buildEditorHtmlFromPdfText(extractionResult.text);
		if (!rebuiltHtml.trim()) {
			throw new UploadSanitizationError({
				code: 'PARSE_ERROR',
				statusCode: 422,
				message: 'No se pudo reconstruir una version editable del PDF.'
			});
		}

		return {
			format: 'pdf',
			safeFileName: context.safeFileName,
			sizeInBytes: context.sizeInBytes,
			summary: 'PDF reconstruido con parser manual para edicion local.',
			contentHash: createHash('sha256').update(sourcePdfBytes).digest('hex'),
			optimizedHTML: rebuiltHtml,
			importMode: 'pdf-manual',
			importNotice:
				'Se reconstruyo una version editable a partir del texto del PDF, sin pasar por la IA. Revisa titulos, listas y saltos antes de exportar.'
		};
	} catch (error) {
		if (error instanceof UploadSanitizationError) {
			throw error;
		}

		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: 'No se pudo preparar este PDF para abrirlo directamente en el editor.',
			cause: error
		});
	}
};
