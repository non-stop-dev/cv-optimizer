import {
	AiProviderRequestError,
	type AiProviderRequestErrorKind
} from '../ai-provider-errors';
import type {
	PdfNativeFallbackCategory,
	PdfNativeFallbackDecision
} from './pdf-processing-types';

const FILE_CONTEXT_PATTERN =
	/\b(pdf|file|files|document|documents|attachment|attachments|upload|uploads|file-parser)\b/i;
const QUOTA_PATTERN =
	/\b(credit|credits|quota|balance|billing|billable|funds|payment|insufficient)\b/i;
const UNSUPPORTED_PATTERN =
	/\b(unsupported|not supported|does not support|doesn't support|cannot accept|can't accept|feature unavailable|feature not available|plugin unavailable|parser unavailable)\b/i;
const ENDPOINT_PATTERN =
	/\b(endpoint|api|files api|uploads api|document api|parser plugin|service disabled|not enabled|disabled|not available|unavailable|not found|404)\b/i;
const REJECTION_PATTERN =
	/\b(reject|rejected|cannot process|can't process|failed to parse|parse failed|invalid pdf|not allowed|blocked)\b/i;

type FallbackEligibleErrorKind =
	| 'pdf-native-files-endpoint-unavailable'
	| 'pdf-native-files-quota-exhausted'
	| 'pdf-native-files-unsupported'
	| 'pdf-native-files-rejected';

const FALLBACK_ELIGIBLE_KINDS = new Set<FallbackEligibleErrorKind>([
	'pdf-native-files-endpoint-unavailable',
	'pdf-native-files-quota-exhausted',
	'pdf-native-files-unsupported',
	'pdf-native-files-rejected'
]);

export const toPdfNativeFallbackKind = (
	category: PdfNativeFallbackCategory
): FallbackEligibleErrorKind => {
	switch (category) {
		case 'files-quota':
			return 'pdf-native-files-quota-exhausted';
		case 'files-unsupported':
			return 'pdf-native-files-unsupported';
		case 'files-endpoint-unavailable':
			return 'pdf-native-files-endpoint-unavailable';
		case 'pdf-rejected':
			return 'pdf-native-files-rejected';
	}
};

const toCategoryFromKind = (
	kind: AiProviderRequestErrorKind | undefined
): PdfNativeFallbackCategory | null => {
	switch (kind) {
		case 'pdf-native-files-quota-exhausted':
			return 'files-quota';
		case 'pdf-native-files-unsupported':
			return 'files-unsupported';
		case 'pdf-native-files-endpoint-unavailable':
			return 'files-endpoint-unavailable';
		case 'pdf-native-files-rejected':
			return 'pdf-rejected';
		default:
			return null;
	}
};

/**
 * Matches only explicit file/PDF-related native-input failures. Generic errors
 * intentionally do not qualify for fallback.
 */
export const classifyPdfNativeFailure = ({
	message,
	kind
}: {
	message?: string;
	kind?: AiProviderRequestErrorKind;
}): PdfNativeFallbackCategory | null => {
	const categoryFromKind = toCategoryFromKind(kind);
	if (categoryFromKind) {
		return categoryFromKind;
	}

	const normalizedMessage = message?.trim().toLowerCase() ?? '';
	if (!normalizedMessage) {
		return null;
	}

	const hasFileContext = FILE_CONTEXT_PATTERN.test(normalizedMessage);

	if (hasFileContext && QUOTA_PATTERN.test(normalizedMessage)) {
		return 'files-quota';
	}

	if (hasFileContext && UNSUPPORTED_PATTERN.test(normalizedMessage)) {
		return 'files-unsupported';
	}

	if (
		(FILE_CONTEXT_PATTERN.test(normalizedMessage) || normalizedMessage.includes('files api')) &&
		ENDPOINT_PATTERN.test(normalizedMessage)
	) {
		return 'files-endpoint-unavailable';
	}

	if (hasFileContext && REJECTION_PATTERN.test(normalizedMessage)) {
		return 'pdf-rejected';
	}

	return null;
};

/**
 * Decides whether the workflow may safely fall back from native PDF input to
 * validated text extraction.
 */
export const decidePdfTextFallback = (error: unknown): PdfNativeFallbackDecision => {
	if (!(error instanceof AiProviderRequestError)) {
		return {
			shouldFallback: false,
			reason: 'La falla no tiene la forma esperada de error del proveedor.'
		};
	}

	const category = classifyPdfNativeFailure({
		message: error.message,
		kind: error.kind
	});

	if (!category) {
		return {
			shouldFallback: false,
			reason:
				'La falla del proveedor no coincide con la allowlist de errores de files/PDF.'
		};
	}

	return {
		shouldFallback: true,
		category,
		reason: error.message,
		providerErrorKind: FALLBACK_ELIGIBLE_KINDS.has(
			error.kind as FallbackEligibleErrorKind
		)
			? error.kind
			: toPdfNativeFallbackKind(category)
	};
};
