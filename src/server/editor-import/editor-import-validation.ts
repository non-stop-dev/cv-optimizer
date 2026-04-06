import { UploadSanitizationError } from '../llm-processing/upload/errors';
import { assertUploadIsAllowed } from '../llm-processing/upload/validators';

type AllowedEditorImportFormat = 'html' | 'pdf';

export interface EditorImportValidationContext {
	format: AllowedEditorImportFormat;
	fileName: string;
	safeFileName: string;
	mimeType: string;
	sizeInBytes: number;
}

/**
 * Restricts direct editor imports to formats the editor can reconstruct
 * without involving the optimization pipeline.
 */
export const assertEditorImportIsAllowed = (
	file: File
): EditorImportValidationContext => {
	const context = assertUploadIsAllowed(file);

	if (context.format !== 'html' && context.format !== 'pdf') {
		throw new UploadSanitizationError({
			code: 'UNSUPPORTED_EXTENSION',
			statusCode: 415,
			message: 'La carga directa al editor solo acepta archivos PDF o HTML.'
		});
	}

	return {
		format: context.format,
		fileName: context.fileName,
		safeFileName: context.safeFileName,
		mimeType: context.mimeType,
		sizeInBytes: context.sizeInBytes
	};
};
