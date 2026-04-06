import type {
	PdfTextExtractionMetrics,
	PdfTextQualityAssessment
} from './pdf-processing-types';

export const PDF_TEXT_EXTRACTION_INSUFFICIENT_MESSAGE =
	'No se pudo extraer suficiente texto del PDF de forma confiable. Usa un PDF con texto seleccionable o prueba otro proveedor. Este proyecto no incluye OCR.';

const MIN_NON_WHITESPACE_CHARS = 160;
const MIN_PRINTABLE_CHAR_RATIO = 0.85;
const MIN_MULTI_PAGE_CHARS_PER_PAGE = 140;
const MAX_EMPTY_PAGE_RATIO_DIVISOR = 2;
const MIN_CHARS_PER_NON_EMPTY_MULTI_PAGE = 120;

/**
 * Applies conservative, fail-closed quality checks before allowing PDF text to
 * replace the native file-input path.
 */
export const assessPdfTextExtractionQuality = (
	metrics: PdfTextExtractionMetrics
): PdfTextQualityAssessment => {
	const failureReasons: string[] = [];

	if (metrics.nonEmptyPageCount === 0) {
		failureReasons.push('El PDF no devolvio texto util en ninguna pagina.');
	}

	if (metrics.totalNonWhitespaceChars < MIN_NON_WHITESPACE_CHARS) {
		failureReasons.push(
			`El texto extraido solo contiene ${metrics.totalNonWhitespaceChars} caracteres no vacios.`
		);
	}

	if (metrics.printableCharRatio < MIN_PRINTABLE_CHAR_RATIO) {
		failureReasons.push(
			`La proporcion de caracteres imprimibles (${metrics.printableCharRatio.toFixed(2)}) es demasiado baja.`
		);
	}

	if (
		metrics.pageCount >= 2 &&
		metrics.totalChars < MIN_MULTI_PAGE_CHARS_PER_PAGE * metrics.pageCount
	) {
		failureReasons.push(
			`El volumen total extraido (${metrics.totalChars} caracteres) es demasiado bajo para ${metrics.pageCount} paginas.`
		);
	}

	if (
		metrics.pageCount >= 2 &&
		metrics.emptyPageCount * MAX_EMPTY_PAGE_RATIO_DIVISOR >= metrics.pageCount
	) {
		failureReasons.push(
			`${metrics.emptyPageCount} de ${metrics.pageCount} paginas quedaron vacias tras la extraccion.`
		);
	}

	if (
		metrics.pageCount >= 2 &&
		metrics.charsPerNonEmptyPage < MIN_CHARS_PER_NON_EMPTY_MULTI_PAGE
	) {
		failureReasons.push(
			`El promedio de texto por pagina no vacia (${metrics.charsPerNonEmptyPage.toFixed(1)}) es sospechosamente bajo.`
		);
	}

	return {
		isAcceptable: failureReasons.length === 0,
		failureReasons,
		metrics
	};
};
