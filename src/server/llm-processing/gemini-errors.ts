export type GeminiRequestErrorKind = 'generic' | 'provider-overloaded' | 'quota-exhausted';

export class GeminiConfigurationError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'GeminiConfigurationError';
	}
}

export class GeminiRequestError extends Error {
	public readonly kind: GeminiRequestErrorKind;

	constructor(message: string, cause?: unknown, kind: GeminiRequestErrorKind = 'generic') {
		super(message, { cause });
		this.name = 'GeminiRequestError';
		this.kind = kind;
	}
}
