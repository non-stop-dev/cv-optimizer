export type AiProviderRequestErrorKind =
	| 'generic'
	| 'provider-overloaded'
	| 'quota-exhausted'
	| 'unsupported-model'
	| 'pdf-native-files-endpoint-unavailable'
	| 'pdf-native-files-quota-exhausted'
	| 'pdf-native-files-unsupported'
	| 'pdf-native-files-rejected'
	| 'pdf-text-extraction-insufficient';

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
