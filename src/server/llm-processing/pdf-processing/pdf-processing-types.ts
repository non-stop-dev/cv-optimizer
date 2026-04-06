import type { AiProviderRequestErrorKind } from '../ai-provider-errors';

export type OptimizeCvProcessingMode =
	| 'text-direct'
	| 'pdf-native-input'
	| 'pdf-text-fallback';

export interface OptimizeCvProcessingInfo {
	mode: OptimizeCvProcessingMode;
	notice: string;
	nativeFailureReason?: string;
}

export interface OptimizeCvResult {
	optimizedHtml: string;
	processing: OptimizeCvProcessingInfo;
}

export interface PdfPageTextMetrics {
	pageNumber: number;
	charCount: number;
	nonWhitespaceCharCount: number;
	lineCount: number;
	isEmpty: boolean;
}

export interface PdfTextExtractionMetrics {
	pageCount: number;
	emptyPageCount: number;
	nonEmptyPageCount: number;
	totalChars: number;
	totalNonWhitespaceChars: number;
	printableCharRatio: number;
	charsPerNonEmptyPage: number;
	pages: PdfPageTextMetrics[];
}

export interface PdfTextExtractionResult {
	text: string;
	metrics: PdfTextExtractionMetrics;
}

export interface PdfTextQualityAssessment {
	isAcceptable: boolean;
	failureReasons: string[];
	metrics: PdfTextExtractionMetrics;
}

export type PdfNativeFallbackCategory =
	| 'files-quota'
	| 'files-unsupported'
	| 'files-endpoint-unavailable'
	| 'pdf-rejected';

export interface PdfNativeFallbackDecision {
	shouldFallback: boolean;
	reason: string;
	category?: PdfNativeFallbackCategory;
	providerErrorKind?: AiProviderRequestErrorKind;
}
