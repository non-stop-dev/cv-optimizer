export type SupportedDocumentFormat = 'pdf' | 'html' | 'yaml' | 'txt';

export interface FormatConfiguration {
	format: SupportedDocumentFormat;
	extensions: readonly string[];
	mimeTypes: readonly string[];
}

export interface UploadValidationContext {
	format: SupportedDocumentFormat;
	fileName: string;
	safeFileName: string;
	mimeType: string;
	sizeInBytes: number;
}

export interface SanitizedUploadResult {
	format: SupportedDocumentFormat;
	originalFileName: string;
	safeFileName: string;
	mimeType: string;
	sizeInBytes: number;
	sanitizedContent: string;
	summary: string;
	contentHash: string;
}
