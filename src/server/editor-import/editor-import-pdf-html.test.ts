import { describe, expect, it } from 'vitest';

import { buildEditorHtmlFromPdfText } from './editor-import-pdf-html';

describe('buildEditorHtmlFromPdfText', () => {
	it('reconstruye nombre, secciones y listas desde texto extraido del PDF', () => {
		const html = buildEditorHtmlFromPdfText(`
ANA PEREZ
Data Analyst | BI Engineer
ana@example.com | Madrid | linkedin.com/in/anaperez

EXPERIENCIA
• Rawr Labs - Dashboarding y analitica de producto.
• MediLeon - Automatizacion y analitica operacional.

HABILIDADES
Python, SQL, Astro, TypeScript
		`);

		expect(html).toContain('<h1>ANA PEREZ</h1>');
		expect(html).toContain('<h2>EXPERIENCIA</h2>');
		expect(html).toContain('<li>Rawr Labs - Dashboarding y analitica de producto.</li>');
		expect(html).toContain('<h2>HABILIDADES</h2>');
		expect(html).toContain('<p>Python, SQL, Astro, TypeScript</p>');
	});

	it('convierte lineas clave-valor en parrafos semanticos', () => {
		const html = buildEditorHtmlFromPdfText(`
LUIS GARCIA

CONTACTO
Email: luis@example.com
Telefono: +34 600 123 123
Portfolio: https://luis.dev
		`);

		expect(html).toContain('<strong>Email:</strong> luis@example.com');
		expect(html).toContain('<strong>Telefono:</strong> +34 600 123 123');
		expect(html).toContain('<strong>Portfolio:</strong> https://luis.dev');
	});

	it('separa headings y bloques cuando el PDF llega casi colapsado en una sola linea', () => {
		const html = buildEditorHtmlFromPdfText(`
MILAGROS PASCUAL
Ubicación: A Coruña I Teléfono: +34624965799 I Email: ninaalejandra85@gmail.com PERFIL PROFESIONAL Profesional del sector Turismo y Hotelería con sólida trayectoria. Idiomas: Español (Nativo), Inglés (Avanzado). EXPERIENCIA LABORAL Agente de Reservas / Sales & Services Teleperformance Perú I Octubre 2025 - Marzo 2026 Gestionar reservas y atención bilingüe. Pastelera Leliciosa Postres I Octubre 2023 - Marzo 2025 Elaborar postres y controlar calidad.
		`);

		expect(html).toContain('<h1>MILAGROS PASCUAL</h1>');
		expect(html).toContain('<strong>Ubicación:</strong> A Coruña');
		expect(html).toContain('<strong>Teléfono:</strong> +34624965799');
		expect(html).toContain('<h2>PERFIL PROFESIONAL</h2>');
		expect(html).toContain('<h2>EXPERIENCIA LABORAL</h2>');
		expect(html).toContain('<h3>Agente de Reservas / Sales &amp; Services Teleperformance Perú | Octubre 2025 - Marzo 2026</h3>');
		expect(html).toContain('<h3>Pastelera Leliciosa Postres | Octubre 2023 - Marzo 2025</h3>');
	});
});
