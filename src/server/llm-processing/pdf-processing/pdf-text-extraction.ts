import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { UploadSanitizationError } from '../upload/errors';
import { normalizePlainText } from '../upload/sanitizers/common';
import type {
	PdfPageTextMetrics,
	PdfTextExtractionMetrics,
	PdfTextExtractionResult
} from './pdf-processing-types';

interface PdfTextItem {
	str: string;
	dir: string;
	transform: number[];
	width: number;
	height: number;
	fontName: string;
	hasEOL: boolean;
}

interface PositionedTextItem {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	hasEOL: boolean;
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const isPdfTextItem = (candidate: unknown): candidate is PdfTextItem => {
	if (!candidate || typeof candidate !== 'object') {
		return false;
	}

	const item = candidate as Partial<PdfTextItem>;
	return (
		typeof item.str === 'string' &&
		Array.isArray(item.transform) &&
		typeof item.hasEOL === 'boolean'
	);
};

const normalizeItemText = (value: string): string => {
	return value.replace(/\r\n?/g, ' ').replace(CONTROL_CHARACTERS, '').replace(/\s+/g, ' ');
};

const toPositionedItem = (item: PdfTextItem): PositionedTextItem | null => {
	const normalizedText = normalizeItemText(item.str);
	if (!normalizedText.trim()) {
		return null;
	}

	const resolvedHeight =
		Math.abs(item.height) || Math.abs(item.transform[3] ?? 0) || 12;
	const resolvedWidth =
		Math.abs(item.width) || Math.max(normalizedText.length, 1) * (resolvedHeight * 0.45);

	return {
		text: normalizedText,
		x: Number(item.transform[4] ?? 0),
		y: Number(item.transform[5] ?? 0),
		width: resolvedWidth,
		height: resolvedHeight,
		hasEOL: item.hasEOL
	};
};

const comparePositionedItems = (
	left: PositionedTextItem,
	right: PositionedTextItem
): number => {
	const verticalDelta = right.y - left.y;
	if (Math.abs(verticalDelta) > 0.8) {
		return verticalDelta;
	}

	if (Math.abs(left.x - right.x) > 0.8) {
		return left.x - right.x;
	}

	return 0;
};

const resolveLineThreshold = (
	currentLine: PositionedTextItem[],
	nextItem: PositionedTextItem
): number => {
	const currentMaxHeight = Math.max(
		nextItem.height,
		...currentLine.map((item) => item.height)
	);
	return Math.max(2, currentMaxHeight * 0.55);
};

const clusterItemsIntoLines = (
	items: PositionedTextItem[]
): PositionedTextItem[][] => {
	if (items.length === 0) {
		return [];
	}

	const sortedItems = [...items].sort(comparePositionedItems);
	const lines: PositionedTextItem[][] = [];

	for (const item of sortedItems) {
		const currentLine = lines.at(-1);
		if (!currentLine) {
			lines.push([item]);
			continue;
		}

		const yDistance = Math.abs(currentLine[0].y - item.y);
		if (yDistance <= resolveLineThreshold(currentLine, item)) {
			currentLine.push(item);
			continue;
		}

		lines.push([item]);
	}

	return lines.map((line) => [...line].sort((left, right) => left.x - right.x));
};

const resolveAverageCharacterWidth = (item: PositionedTextItem): number => {
	return item.width / Math.max(item.text.trim().length, 1);
};

const shouldInsertSpace = (
	accumulatedText: string,
	previousItem: PositionedTextItem,
	nextItem: PositionedTextItem
): boolean => {
	if (!accumulatedText || /\s$/.test(accumulatedText) || /^\s/.test(nextItem.text)) {
		return false;
	}

	const previousText = accumulatedText.trimEnd();
	if (!previousText) {
		return false;
	}

	const previousEndX = previousItem.x + previousItem.width;
	const gap = nextItem.x - previousEndX;
	const gapThreshold =
		Math.max(
			0.6,
			Math.min(
				resolveAverageCharacterWidth(previousItem),
				resolveAverageCharacterWidth(nextItem)
			) * 0.15
		);

	return gap > gapThreshold;
};

const buildLineText = (lineItems: PositionedTextItem[]): string => {
	let lineText = '';
	let previousItem: PositionedTextItem | null = null;

	for (const item of lineItems) {
		if (previousItem && shouldInsertSpace(lineText, previousItem, item)) {
			lineText += ' ';
		}

		lineText += item.text;

		if (item.hasEOL) {
			lineText += '\n';
		}

		previousItem = item;
	}

	return lineText
		.split('\n')
		.map((segment) => segment.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n');
};

const countPrintableCharacters = (value: string): number => {
	let printableCount = 0;

	for (const character of value) {
		if (!CONTROL_CHARACTERS.test(character)) {
			printableCount += 1;
		}
		CONTROL_CHARACTERS.lastIndex = 0;
	}

	return printableCount;
};

const toPageMetrics = (pageNumber: number, pageText: string): PdfPageTextMetrics => {
	const nonWhitespaceCharCount = pageText.replace(/\s+/g, '').length;
	const lineCount = pageText.length === 0 ? 0 : pageText.split('\n').filter(Boolean).length;

	return {
		pageNumber,
		charCount: pageText.length,
		nonWhitespaceCharCount,
		lineCount,
		isEmpty: nonWhitespaceCharCount === 0
	};
};

const buildExtractionMetrics = (
	pageMetrics: PdfPageTextMetrics[],
	rawDocumentText: string,
	normalizedDocumentText: string
): PdfTextExtractionMetrics => {
	const pageCount = pageMetrics.length;
	const emptyPageCount = pageMetrics.filter((page) => page.isEmpty).length;
	const nonEmptyPageCount = pageCount - emptyPageCount;
	const totalChars = normalizedDocumentText.length;
	const totalNonWhitespaceChars = normalizedDocumentText.replace(/\s+/g, '').length;
	const printableCharacters = countPrintableCharacters(rawDocumentText);
	const printableCharRatio =
		rawDocumentText.length === 0 ? 0 : printableCharacters / rawDocumentText.length;
	const charsPerNonEmptyPage =
		nonEmptyPageCount === 0 ? 0 : totalChars / nonEmptyPageCount;

	return {
		pageCount,
		emptyPageCount,
		nonEmptyPageCount,
		totalChars,
		totalNonWhitespaceChars,
		printableCharRatio,
		charsPerNonEmptyPage,
		pages: pageMetrics
	};
};

/**
 * Extracts text from every PDF page and rebuilds readable blocks in page order.
 */
export const extractTextFromPdf = async (
	pdfBytes: Uint8Array
): Promise<PdfTextExtractionResult> => {
	const loadingTask = getDocument({
		data: pdfBytes,
		isEvalSupported: false,
		stopAtErrors: true,
		useSystemFonts: false
	});

	try {
		const pdf = await loadingTask.promise;
		const pageTexts: string[] = [];
		const pageMetrics: PdfPageTextMetrics[] = [];

		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const textContent = await page.getTextContent({
				includeMarkedContent: false,
				disableNormalization: true
			});

			const positionedItems = textContent.items
				.filter(isPdfTextItem)
				.map(toPositionedItem)
				.filter((item): item is PositionedTextItem => item !== null);

			const pageText = normalizePlainText(
				clusterItemsIntoLines(positionedItems)
					.map(buildLineText)
					.filter(Boolean)
					.join('\n')
			);

			pageTexts.push(pageText);
			pageMetrics.push(toPageMetrics(pageNumber, pageText));
		}

		const rawDocumentText = pageTexts.join('\n\n');
		const normalizedDocumentText = normalizePlainText(rawDocumentText);

		return {
			text: normalizedDocumentText,
			metrics: buildExtractionMetrics(
				pageMetrics,
				rawDocumentText,
				normalizedDocumentText
			)
		};
	} catch (error) {
		if (error instanceof UploadSanitizationError) {
			throw error;
		}

		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: 'No se pudo extraer texto util del PDF para abrirlo directamente en el editor.',
			cause: error
		});
	} finally {
		await loadingTask.destroy();
	}
};
