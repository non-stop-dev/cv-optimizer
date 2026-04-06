import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import {
	DEFAULT_CV_TEMPLATE_ID,
	toCvTemplateId,
	type CvTemplateId
} from '../../styles/cv-templates/cv-template-options';

const PAYLOAD_START_MARKER = 'CVOPTEDITABLEPAYLOADV1START';
const PAYLOAD_END_MARKER = 'CVOPTEDITABLEPAYLOADV1END';
const PAYLOAD_CHUNK_SIZE = 180;

interface PrintableEditablePayload {
	optimizedHTML: string;
	primaryColor: string;
	templateId: CvTemplateId;
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	if (typeof btoa === 'function') {
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
	}

	return Buffer.from(bytes).toString('base64url');
};

const base64UrlToBytes = (value: string): Uint8Array => {
	const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
	const paddedValue =
		normalizedValue + '='.repeat((4 - (normalizedValue.length % 4 || 4)) % 4);

	if (typeof atob === 'function') {
		const binary = atob(paddedValue);
		const bytes = new Uint8Array(binary.length);

		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}

		return bytes;
	}

	return Uint8Array.from(Buffer.from(paddedValue, 'base64'));
};

const splitIntoChunks = (value: string, size: number): string[] => {
	const chunks: string[] = [];

	for (let cursor = 0; cursor < value.length; cursor += size) {
		chunks.push(value.slice(cursor, cursor + size));
	}

	return chunks;
};

const escapeHtml = (value: string): string => {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

const escapeRegExp = (value: string): string => {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Serializes the canonical editable state so browser-generated PDFs can retain
 * an exact round-trip source for later imports.
 */
export const buildPrintableEditablePayloadText = (
	optimizedHTML: string,
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const safeOptimizedHtml = sanitizeCvHtml(optimizedHTML);
	if (!safeOptimizedHtml.trim()) {
		return '';
	}

	const payloadJson = JSON.stringify({
		optimizedHTML: safeOptimizedHtml,
		primaryColor,
		templateId: toCvTemplateId(templateId)
	} satisfies PrintableEditablePayload);
	const payloadBase64 = bytesToBase64Url(new TextEncoder().encode(payloadJson));
	const payloadChunks = splitIntoChunks(payloadBase64, PAYLOAD_CHUNK_SIZE);

	return [PAYLOAD_START_MARKER, ...payloadChunks, PAYLOAD_END_MARKER].join('\n');
};

/**
 * Wraps the printable payload in a print-only block so it survives PDF export
 * without altering the visible preview.
 */
export const buildPrintableEditablePayloadBlock = (
	optimizedHTML: string,
	primaryColor: string,
	templateId: CvTemplateId = DEFAULT_CV_TEMPLATE_ID
): string => {
	const payloadText = buildPrintableEditablePayloadText(
		optimizedHTML,
		primaryColor,
		templateId
	);
	if (!payloadText) {
		return '';
	}

	return `<pre class="cv-editable-payload" aria-hidden="true">${escapeHtml(payloadText)}</pre>`;
};

/**
 * Attempts to recover the canonical editable HTML embedded inside a PDF export.
 */
export const extractPrintableEditablePayload = (
	extractedPdfText: string
): PrintableEditablePayload | null => {
	const payloadMatch = extractedPdfText.match(
		new RegExp(
			`${escapeRegExp(PAYLOAD_START_MARKER)}([\\s\\S]*?)${escapeRegExp(PAYLOAD_END_MARKER)}`
		)
	);
	if (!payloadMatch) {
		return null;
	}

	const compactPayload = payloadMatch[1]?.replace(/\s+/g, '') ?? '';
	if (!compactPayload) {
		return null;
	}

	try {
		const payloadJson = new TextDecoder().decode(base64UrlToBytes(compactPayload));
		const parsedPayload = JSON.parse(payloadJson) as Partial<PrintableEditablePayload>;
		const safeOptimizedHtml =
			typeof parsedPayload.optimizedHTML === 'string'
				? sanitizeCvHtml(parsedPayload.optimizedHTML)
				: '';
		if (!safeOptimizedHtml.trim()) {
			return null;
		}

		return {
			optimizedHTML: safeOptimizedHtml,
			primaryColor:
				typeof parsedPayload.primaryColor === 'string' &&
				parsedPayload.primaryColor.trim().length > 0
					? parsedPayload.primaryColor
					: '#0f766e',
			templateId: toCvTemplateId(parsedPayload.templateId)
		};
	} catch {
		return null;
	}
};
