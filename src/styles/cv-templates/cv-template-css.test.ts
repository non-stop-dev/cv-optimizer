import { describe, expect, it } from 'vitest';

import { buildCvTemplateCss } from './cv-template-css';

describe('buildCvTemplateCss', () => {
	it('mantiene la plantilla default como baseline editorial', () => {
		const css = buildCvTemplateCss('.cv-doc', 'default');

		expect(css).toContain('border-left: 3px solid');
		expect(css).toContain('text-transform: uppercase;');
		expect(css).not.toContain('border-radius: 999px;');
	});

	it('hace executive visualmente distinta con encabezados tipo etiqueta', () => {
		const css = buildCvTemplateCss('.cv-doc', 'executive');

		expect(css).toContain('border-radius: 999px;');
		expect(css).toContain('text-transform: uppercase;');
		expect(css).toContain('border-top: 1px solid');
	});

	it('hace minimal visualmente distinta con secciones lineales', () => {
		const css = buildCvTemplateCss('.cv-doc', 'minimal');

		expect(css).toContain('display: flex;');
		expect(css).toContain('h2::after');
		expect(css).not.toContain('border-left: 3px solid');
	});

	it('hace serif visualmente distinta con tono clásico', () => {
		const css = buildCvTemplateCss('.cv-doc', 'serif');

		expect(css).toContain('font-variant-caps: small-caps;');
		expect(css).toContain('font-style: italic;');
		expect(css).toContain('"Palatino Linotype"');
	});
});
