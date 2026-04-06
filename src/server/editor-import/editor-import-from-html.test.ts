import { describe, expect, it } from 'vitest';

import { importHtmlDocumentToEditor } from './editor-import-from-html';

describe('importHtmlDocumentToEditor', () => {
	it('extrae el fragmento editable y elimina wrappers exportados', async () => {
		const file = new File(
			[
				`<!doctype html>
				<html lang="es">
					<head>
						<title>CV</title>
						<style>body { color: red; }</style>
					</head>
					<body>
						<article class="cv-doc">
							<section><h1>Ana Perez</h1><script>alert(1)</script><p>Data Analyst</p></section>
						</article>
					</body>
				</html>`
			],
			'cv.html',
			{ type: 'text/html' }
		);

		const result = await importHtmlDocumentToEditor(file);

		expect(result.format).toBe('html');
		expect(result.importMode).toBe('html-direct');
		expect(result.optimizedHTML).toContain('<section><h1>Ana Perez</h1><p>Data Analyst</p></section>');
		expect(result.optimizedHTML).not.toContain('<article');
		expect(result.optimizedHTML).not.toContain('<script');
	});
});
