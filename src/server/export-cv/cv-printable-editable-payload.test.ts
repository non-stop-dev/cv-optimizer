import { describe, expect, it, vi } from 'vitest';

vi.mock('../llm-processing/cv-html-sanitizer', () => ({
	sanitizeCvHtml: (html: string) => html
}));

import { buildPrintableHtmlEditable, buildPrintableHtmlSimple } from './cv-export';
import {
	buildPrintableEditablePayloadText,
	extractPrintableEditablePayload
} from './cv-printable-editable-payload';

describe('cv printable editable payload', () => {
	it('serializa y recupera el HTML canonico para round-trip PDF', () => {
		const payloadText = buildPrintableEditablePayloadText(
			'<section><h2>Experiencia</h2><ul><li>Rawr Labs</li></ul></section>',
			'#0f766e',
			'minimal'
		);

		const recoveredPayload = extractPrintableEditablePayload(payloadText);

		expect(recoveredPayload).toEqual({
			optimizedHTML: '<section><h2>Experiencia</h2><ul><li>Rawr Labs</li></ul></section>',
			primaryColor: '#0f766e',
			templateId: 'minimal'
		});
	});

	it('inyecta la carga editable dentro del HTML imprimible', () => {
		const printableHtml = buildPrintableHtmlEditable(
			'<section><h2>Experiencia</h2><ul><li>Rawr Labs</li></ul></section>',
			'#0f766e',
			'minimal'
		);

		expect(printableHtml).toContain('cv-editable-payload');
		expect(printableHtml).toContain('CVOPTEDITABLEPAYLOADV1START');
		expect(printableHtml).toContain('CVOPTEDITABLEPAYLOADV1END');
	});

	it('mantiene el pdf simple sin la carga editable interna', () => {
		const printableHtml = buildPrintableHtmlSimple(
			'<section><h2>Experiencia</h2><ul><li>Rawr Labs</li></ul></section>',
			'#0f766e',
			'minimal'
		);

		expect(printableHtml).not.toContain('CVOPTEDITABLEPAYLOADV1START');
		expect(printableHtml).not.toContain('CVOPTEDITABLEPAYLOADV1END');
	});
});
