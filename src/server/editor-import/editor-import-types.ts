export type EditorImportMode = 'html-direct' | 'pdf-manual' | 'pdf-embedded-editable';

export interface EditorImportResult {
	format: 'html' | 'pdf';
	safeFileName: string;
	sizeInBytes: number;
	summary: string;
	contentHash: string;
	optimizedHTML: string;
	importMode: EditorImportMode;
	importNotice: string;
}
