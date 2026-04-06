import { describe, expect, it, vi } from 'vitest';

vi.mock('../llm-processing/cv-html-sanitizer', () => ({
	sanitizeCvHtml: (html: string) => html
}));

import { buildPrintableEditablePayloadText } from '../export-cv/cv-printable-editable-payload';
import * as pdfTextExtractionModule from '../llm-processing/pdf-processing/pdf-text-extraction';
import { createPdfFileFixture } from '../llm-processing/pdf-processing/pdf-test-fixtures';
import { importPdfDocumentToEditor } from './editor-import-from-pdf';

describe('importPdfDocumentToEditor', () => {
	it('convierte un PDF textual en HTML editable', async () => {
		const file = createPdfFileFixture([
			[
				'ANA PEREZ',
				'Data Analyst | Madrid | ana@example.com',
				'Especialista en analitica de producto, reporting ejecutivo y automatizacion de procesos con foco en negocio.'
			].join('\n'),
			[
				'EXPERIENCIA',
				'• Rawr Labs - Analitica y dashboards',
				'• MediLeon - Automatizacion operacional y seguimiento de metricas',
				'• Proyecto Parlamentario - Sintesis legislativa, scraping y clasificacion documental',
				'Diseno tableros, modelo datos, documento hallazgos y coordino entregas con stakeholders.'
			].join('\n')
		]);

		const result = await importPdfDocumentToEditor(file);

		expect(result.format).toBe('pdf');
		expect(result.importMode).toBe('pdf-manual');
		expect(result.optimizedHTML).toContain('<h1>ANA PEREZ</h1>');
		expect(result.optimizedHTML).toContain('<h2>EXPERIENCIA</h2>');
		expect(result.optimizedHTML).toContain('Rawr Labs - Analitica y dashboards');
	});

	it('devuelve error controlado cuando el PDF no aporta texto suficiente', async () => {
		const file = createPdfFileFixture(['Logo']);

		await expect(importPdfDocumentToEditor(file)).rejects.toMatchObject({
			code: 'PARSE_ERROR',
			statusCode: 422
		});
	});

	it('prioriza el HTML embebido cuando el PDF fue exportado por CV Optimizer', async () => {
		const embeddedPayloadText = buildPrintableEditablePayloadText(
			'<section><h2>Experiencia</h2><ul><li>Rawr Labs</li></ul></section>',
			'#0f766e',
			'minimal'
		);
		const extractTextSpy = vi
			.spyOn(pdfTextExtractionModule, 'extractTextFromPdf')
			.mockResolvedValue({
				text: embeddedPayloadText,
				metrics: {
					pageCount: 1,
					emptyPageCount: 0,
					nonEmptyPageCount: 1,
					totalChars: embeddedPayloadText.length,
					totalNonWhitespaceChars: embeddedPayloadText.replace(/\s+/g, '').length,
					printableCharRatio: 1,
					charsPerNonEmptyPage: embeddedPayloadText.length,
					pages: [
						{
							pageNumber: 1,
							charCount: embeddedPayloadText.length,
							nonWhitespaceCharCount: embeddedPayloadText.replace(/\s+/g, '').length,
							lineCount: embeddedPayloadText.split('\n').length,
							isEmpty: false
						}
					]
				}
			});
		const file = createPdfFileFixture(['payload']);

		try {
			const result = await importPdfDocumentToEditor(file);

			expect(result.importMode).toBe('pdf-embedded-editable');
			expect(result.optimizedHTML).toContain('<ul><li>Rawr Labs</li></ul>');
			expect(result.importNotice).toContain('HTML original embebido');
		} finally {
			extractTextSpy.mockRestore();
		}
	});
});
