import {
	DEFAULT_CV_TEMPLATE_ID,
	buildHtmlExportDocument,
	buildPrintableHtml,
	downloadTextFile,
	openPrintPreview,
	toSafeFileName
} from '../export-cv/cv-export';
import type { DocumentUploadStatusTone } from './document-upload-status.client';

interface CreateDocumentUploadExportWorkflowOptions {
	resultPreview: HTMLElement;
	cvPrimaryColorPicker: HTMLInputElement;
	getCurrentDocumentBaseName: () => string;
	setStatus: (tone: DocumentUploadStatusTone, title: string, message: string) => void;
}

interface DocumentUploadExportWorkflow {
	exportCurrentHtml: () => void;
	exportCurrentTxt: () => void;
	exportCurrentPdf: () => void;
}

/**
 * Provides HTML, TXT, and PDF export actions for the upload preview workspace.
 */
export const createDocumentUploadExportWorkflow = (
	options: CreateDocumentUploadExportWorkflowOptions
): DocumentUploadExportWorkflow => {
	const {
		resultPreview,
		cvPrimaryColorPicker,
		getCurrentDocumentBaseName,
		setStatus
	} = options;

	const exportCurrentHtml = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Genera o edita un CV antes de exportar.');
			return;
		}

		const fileName = toSafeFileName(getCurrentDocumentBaseName(), 'html');
		const htmlDocument = buildHtmlExportDocument(
			resultPreview.innerHTML,
			cvPrimaryColorPicker.value,
			DEFAULT_CV_TEMPLATE_ID
		);
		downloadTextFile(fileName, htmlDocument, 'text/html;charset=utf-8');
	};

	const exportCurrentTxt = (): void => {
		const plainText = resultPreview.innerText.trim();
		if (!plainText) {
			setStatus('error', 'No hay contenido para exportar', 'Genera o edita un CV antes de exportar.');
			return;
		}

		const fileName = toSafeFileName(getCurrentDocumentBaseName(), 'txt');
		downloadTextFile(fileName, plainText, 'text/plain;charset=utf-8');
	};

	const exportCurrentPdf = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Genera o edita un CV antes de exportar.');
			return;
		}

		const printableHtml = buildPrintableHtml(
			resultPreview.innerHTML,
			cvPrimaryColorPicker.value,
			DEFAULT_CV_TEMPLATE_ID
		);
		const opened = openPrintPreview(printableHtml);
		if (!opened) {
			setStatus(
				'error',
				'No se pudo abrir la vista de impresion',
				'Tu navegador bloqueo la ventana emergente. Habilita pop-ups e intenta nuevamente.'
			);
			return;
		}

		setStatus(
			'proceso',
			'PDF listo para imprimir',
			'Se abrio una pestana de impresion. Si no aparece el dialogo automatico, usa Cmd/Ctrl+P para guardar como PDF.'
		);
	};

	return {
		exportCurrentHtml,
		exportCurrentTxt,
		exportCurrentPdf
	};
};
