import type { FormatConfiguration } from './types';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CONTENT_LENGTH = 400_000;
export const MAX_YAML_DEPTH = 14;
export const MAX_PDF_PAGES = 35;

export const PDF_DANGEROUS_MARKERS: readonly string[] = [
	'/JavaScript',
	'/JS',
	'/Launch',
	'/RichMedia',
	'/EmbeddedFile',
	'/XFA'
];

export const FORMAT_CONFIGURATIONS: readonly FormatConfiguration[] = [
	{
		format: 'pdf',
		extensions: ['.pdf'],
		mimeTypes: ['application/pdf']
	},
	{
		format: 'html',
		extensions: ['.html'],
		mimeTypes: ['text/html', 'application/xhtml+xml']
	},
	{
		format: 'yaml',
		extensions: ['.yaml', '.yml'],
		mimeTypes: ['application/yaml', 'application/x-yaml', 'text/yaml', 'text/x-yaml']
	},
	{
		format: 'txt',
		extensions: ['.txt'],
		mimeTypes: ['text/plain']
	}
];
