import { describe, expect, it } from 'vitest';

import {
	buildPdfFixture,
	buildPdfFixtureFromContentStreams,
	buildTextContentStream
} from './pdf-test-fixtures';
import { extractTextFromPdf } from './pdf-text-extraction';

describe('extractTextFromPdf', () => {
	it('acumula texto de todas las paginas sin truncar silenciosamente', async () => {
		const pdfBytes = buildPdfFixture([
			[
				'Laura Perez',
				'Analista de datos con experiencia en reporting financiero y automatizacion.'
			].join('\n'),
			[
				'Experiencia',
				'Empresa Uno | Analista BI | 2022-2025',
				'Disene dashboards, modele datos y coordine entregas con equipos comerciales.'
			].join('\n')
		]);

		const extraction = await extractTextFromPdf(pdfBytes);

		expect(extraction.metrics.pageCount).toBe(2);
		expect(extraction.metrics.emptyPageCount).toBe(0);
		expect(extraction.text).toContain('Laura Perez');
		expect(extraction.text).toContain('Empresa Uno | Analista BI | 2022-2025');
		expect(extraction.metrics.totalChars).toBeGreaterThan(150);
	});

	it('reconstruye lineas fragmentadas respetando el orden de lectura', async () => {
		const fragmentedPdf = buildPdfFixtureFromContentStreams([
			buildTextContentStream([
				['Senior ', 'Data ', 'Engineer'],
				['Python ', 'SQL ', 'ETL']
			])
		]);

		const extraction = await extractTextFromPdf(fragmentedPdf);

		expect(extraction.text).toContain('Senior Data Engineer');
		expect(extraction.text).toContain('Python SQL ETL');
	});
});
