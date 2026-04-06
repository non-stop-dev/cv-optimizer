export type AiProviderRequestErrorKind =
	| 'generic'
	| 'provider-overloaded'
	| 'quota-exhausted'
	| 'unsupported-model';

/**
 * Error used when the AI provider runtime configuration is incomplete or invalid.
 */
export class AiProviderConfigurationError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'AiProviderConfigurationError';
	}
}

/**
 * Error used when the configured AI provider rejects or cannot fulfill a request.
 */
export class AiProviderRequestError extends Error {
	public readonly kind: AiProviderRequestErrorKind;

	constructor(
		message: string,
		cause?: unknown,
		kind: AiProviderRequestErrorKind = 'generic'
	) {
		super(message, { cause });
		this.name = 'AiProviderRequestError';
		this.kind = kind;
	}
}
