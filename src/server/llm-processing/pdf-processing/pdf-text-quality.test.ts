import { describe, expect, it } from 'vitest';

import { assessPdfTextExtractionQuality } from './pdf-text-quality';

const createMetrics = (overrides: Partial<Parameters<typeof assessPdfTextExtractionQuality>[0]> = {}) => ({
	pageCount: 2,
	emptyPageCount: 0,
	nonEmptyPageCount: 2,
	totalChars: 420,
	totalNonWhitespaceChars: 360,
	printableCharRatio: 0.98,
	charsPerNonEmptyPage: 210,
	pages: [
		{
			pageNumber: 1,
			charCount: 220,
			nonWhitespaceCharCount: 190,
			lineCount: 8,
			isEmpty: false
		},
		{
			pageNumber: 2,
			charCount: 200,
			nonWhitespaceCharCount: 170,
			lineCount: 7,
			isEmpty: false
		}
	],
	...overrides
});

describe('assessPdfTextExtractionQuality', () => {
	it('acepta una extraccion con suficiente volumen y paginas no vacias', () => {
		const assessment = assessPdfTextExtractionQuality(createMetrics());

		expect(assessment.isAcceptable).toBe(true);
		expect(assessment.failureReasons).toHaveLength(0);
	});

	it('rechaza PDFs sin paginas con texto util', () => {
		const assessment = assessPdfTextExtractionQuality(
			createMetrics({
				emptyPageCount: 2,
				nonEmptyPageCount: 0,
				totalChars: 0,
				totalNonWhitespaceChars: 0,
				printableCharRatio: 0,
				charsPerNonEmptyPage: 0,
				pages: [
					{
						pageNumber: 1,
						charCount: 0,
						nonWhitespaceCharCount: 0,
						lineCount: 0,
						isEmpty: true
					},
					{
						pageNumber: 2,
						charCount: 0,
						nonWhitespaceCharCount: 0,
						lineCount: 0,
						isEmpty: true
					}
				]
			})
		);

		expect(assessment.isAcceptable).toBe(false);
		expect(assessment.failureReasons.join(' ')).toContain('ninguna pagina');
	});

	it('rechaza extracciones multipagina sospechosamente cortas', () => {
		const assessment = assessPdfTextExtractionQuality(
			createMetrics({
				totalChars: 96,
				totalNonWhitespaceChars: 72,
				charsPerNonEmptyPage: 48
			})
		);

		expect(assessment.isAcceptable).toBe(false);
		expect(assessment.failureReasons.length).toBeGreaterThan(0);
	});
});
