import { createHash } from 'node:crypto';

import { UploadSanitizationError } from './errors';
import { sanitizeHtmlDocument } from './sanitizers/html';
import { sanitizePdfDocument } from './sanitizers/pdf';
import { sanitizeTextDocument } from './sanitizers/text';
import { sanitizeYamlDocument } from './sanitizers/yaml';
import type {
	SanitizedUploadResult,
	SupportedDocumentFormat,
	UploadValidationContext
} from './types';
import { assertUploadIsAllowed } from './validators';

const decodeTextContent = (
	bytes: Uint8Array,
	format: SupportedDocumentFormat
): string => {
	try {
		const decoder = new TextDecoder('utf-8', { fatal: true });
		return decoder.decode(bytes);
	} catch (error) {
		throw new UploadSanitizationError({
			code: 'INVALID_ENCODING',
			statusCode: 422,
			message: `No se pudo leer el archivo ${format.toUpperCase()} como UTF-8 valido.`,
			cause: error
		});
	}
};

const summarizeSanitization = (
	context: UploadValidationContext,
	sanitizedContent: string
): string => {
	const wordCount = sanitizedContent.split(/\s+/).filter(Boolean).length;
	return `${context.format.toUpperCase()} sanitizado con ${wordCount} palabras listas para procesar.`;
};

export const sanitizeUploadedDocument = async (
	file: File
): Promise<SanitizedUploadResult> => {
	const context = assertUploadIsAllowed(file);
	const bytes = new Uint8Array(await file.arrayBuffer());

	let sanitizedContent = '';
	switch (context.format) {
		case 'pdf': {
			sanitizedContent = await sanitizePdfDocument(bytes);
			break;
		}
		case 'html': {
			const htmlContent = decodeTextContent(bytes, context.format);
			sanitizedContent = sanitizeHtmlDocument(htmlContent);
			break;
		}
		case 'yaml': {
			const yamlContent = decodeTextContent(bytes, context.format);
			sanitizedContent = sanitizeYamlDocument(yamlContent);
			break;
		}
		case 'txt': {
			const textContent = decodeTextContent(bytes, context.format);
			sanitizedContent = sanitizeTextDocument(textContent);
			break;
		}
		default: {
			throw new UploadSanitizationError({
				code: 'UNSUPPORTED_EXTENSION',
				statusCode: 415,
				message: 'Formato no soportado para sanitizacion.'
			});
		}
	}

	return {
		format: context.format,
		originalFileName: context.fileName,
		safeFileName: context.safeFileName,
		mimeType: context.mimeType,
		sizeInBytes: context.sizeInBytes,
		sanitizedContent,
		summary: summarizeSanitization(context, sanitizedContent),
		contentHash: createHash('sha256').update(sanitizedContent, 'utf-8').digest('hex')
	};
};
