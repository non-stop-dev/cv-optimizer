import { createHash } from 'node:crypto';

import { UploadSanitizationError } from '../llm-processing/upload/errors';
import { sanitizeHtmlDocument } from '../llm-processing/upload/sanitizers/html';
import type { EditorImportResult } from './editor-import-types';
import { assertEditorImportIsAllowed } from './editor-import-validation';

const extractEditorHtmlFragment = (rawHtml: string): string => {
	const bodyMatch = rawHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
	const bodyOrDocument = bodyMatch?.[1] ?? rawHtml;
	const exportedArticleMatch = bodyOrDocument.match(
		/<article\b[^>]*class=(["'])[^"']*\bcv-doc\b[^"']*\1[^>]*>([\s\S]*?)<\/article>/i
	);

	return exportedArticleMatch?.[2] ?? bodyOrDocument;
};

/**
 * Sanitizes a user-supplied HTML export and extracts only the editable CV
 * fragment so the dedicated editor does not nest full-document wrappers.
 */
export const importHtmlDocumentToEditor = async (
	file: File
): Promise<EditorImportResult> => {
	const context = assertEditorImportIsAllowed(file);
	if (context.format !== 'html') {
		throw new UploadSanitizationError({
			code: 'UNSUPPORTED_EXTENSION',
			statusCode: 415,
			message: 'La importacion HTML directa requiere un archivo .html valido.'
		});
	}

	const rawHtml = await file.text();
	const safeEditorHtml = sanitizeHtmlDocument(extractEditorHtmlFragment(rawHtml));
	if (!safeEditorHtml.trim()) {
		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: 'El HTML no contiene contenido editable util para abrir en el editor.'
		});
	}

	return {
		format: 'html',
		safeFileName: context.safeFileName,
		sizeInBytes: context.sizeInBytes,
		summary: 'HTML sanitizado y cargado directamente en el editor.',
		contentHash: createHash('sha256').update(safeEditorHtml, 'utf-8').digest('hex'),
		optimizedHTML: safeEditorHtml,
		importMode: 'html-direct',
		importNotice: 'El HTML se cargo directamente en el editor sin pasar por la IA.'
	};
};
