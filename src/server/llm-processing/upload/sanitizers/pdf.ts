import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { MAX_PDF_PAGES, PDF_DANGEROUS_MARKERS } from '../constants';
import { UploadSanitizationError } from '../errors';
import { ensureContentWithinLimit } from './common';

const ACTIVE_ACTION_SIGNATURES: ReadonlyArray<{ label: string; pattern: RegExp }> = [
	{
		label: '/AA con accion activa',
		pattern: /\/AA\s*<<[\s\S]{0,1200}?\/(?:JavaScript|JS|Launch|RichMedia|EmbeddedFile)\b/i
	},
	{
		label: '/OpenAction con accion activa',
		pattern: /\/OpenAction\s*<<[\s\S]{0,1200}?\/(?:JavaScript|JS|Launch|RichMedia|EmbeddedFile)\b/i
	}
];

const findDangerousMarker = (pdfBytes: Uint8Array): string | null => {
	const scannedText = new TextDecoder('latin1').decode(pdfBytes);

	for (const marker of PDF_DANGEROUS_MARKERS) {
		if (scannedText.includes(marker)) {
			return marker;
		}
	}

	for (const signature of ACTIVE_ACTION_SIGNATURES) {
		if (signature.pattern.test(scannedText)) {
			return signature.label;
		}
	}

	return null;
};

const isTextItem = (value: unknown): value is { str: string } => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if (!('str' in value)) {
		return false;
	}

	return typeof value.str === 'string';
};

export const sanitizePdfDocument = async (pdfBytes: Uint8Array): Promise<string> => {
	const dangerousMarker = findDangerousMarker(pdfBytes);
	if (dangerousMarker) {
		throw new UploadSanitizationError({
			code: 'UNSAFE_CONTENT',
			statusCode: 422,
			message: `El PDF incluye contenido activo bloqueado (${dangerousMarker}).`
		});
	}

	const loadingTask = getDocument({
		data: pdfBytes,
		isEvalSupported: false,
		stopAtErrors: true,
		useSystemFonts: false
	});

	try {
		const pdf = await loadingTask.promise;
		if (pdf.numPages > MAX_PDF_PAGES) {
			throw new UploadSanitizationError({
				code: 'PARSE_ERROR',
				statusCode: 422,
				message: `El PDF excede el maximo de ${MAX_PDF_PAGES} paginas permitidas.`
			});
		}

		const pagesText: string[] = [];
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const textContent = await page.getTextContent();
			const pageText = textContent.items
				.map((item) => (isTextItem(item) ? item.str : ''))
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();

			if (pageText) {
				pagesText.push(pageText);
			}

			page.cleanup();
		}

		return ensureContentWithinLimit(pagesText.join('\n\n'), 'PDF');
	} catch (error) {
		if (error instanceof UploadSanitizationError) {
			throw error;
		}

		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: 'No se pudo extraer contenido del PDF de forma segura.',
			cause: error
		});
	} finally {
		await loadingTask.destroy();
	}
};
