import { UploadSanitizationError } from '../llm-processing/upload/errors';
import type { EditorImportResult } from './editor-import-types';
import { assertEditorImportIsAllowed } from './editor-import-validation';
import { importHtmlDocumentToEditor } from './editor-import-from-html';
import { importPdfDocumentToEditor } from './editor-import-from-pdf';

/**
 * Routes supported direct-import files to the editor-specific import workflow.
 */
export const importDocumentToEditor = async (
	file: File
): Promise<EditorImportResult> => {
	const context = assertEditorImportIsAllowed(file);

	switch (context.format) {
		case 'html':
			return await importHtmlDocumentToEditor(file);
		case 'pdf':
			return await importPdfDocumentToEditor(file);
		default:
			throw new UploadSanitizationError({
				code: 'UNSUPPORTED_EXTENSION',
				statusCode: 415,
				message: 'La carga directa al editor solo acepta archivos PDF o HTML.'
			});
	}
};
