export type UploadErrorCode =
	| 'INVALID_REQUEST'
	| 'MISSING_FILE'
	| 'EMPTY_FILE'
	| 'UNSUPPORTED_EXTENSION'
	| 'UNSUPPORTED_MIME_TYPE'
	| 'FILE_TOO_LARGE'
	| 'INVALID_ENCODING'
	| 'UNSAFE_CONTENT'
	| 'PARSE_ERROR';

interface UploadSanitizationErrorOptions {
	message: string;
	code: UploadErrorCode;
	statusCode: number;
	cause?: unknown;
}

export class UploadSanitizationError extends Error {
	public readonly code: UploadErrorCode;
	public readonly statusCode: number;

	public constructor(options: UploadSanitizationErrorOptions) {
		super(options.message, { cause: options.cause });
		this.name = 'UploadSanitizationError';
		this.code = options.code;
		this.statusCode = options.statusCode;
	}
}
