import {
	buildHtmlExportDocument,
	buildPrintableHtml,
	downloadTextFile,
	openPrintPreview,
	toSafeFileName,
	type CvTemplateId
} from '../export-cv/cv-export';

type StatusTone = 'proceso' | 'exito' | 'error';

interface CreateOptimizerEditionExportWorkflowOptions {
	resultPreview: HTMLElement;
	cvPrimaryColorPicker: HTMLInputElement;
	getSelectedTemplateId: () => CvTemplateId;
	getCurrentDocumentBaseName: () => string;
	setStatus: (tone: StatusTone, title: string, message: string) => void;
	exportMenuList: HTMLElement;
	exportMenuTrigger: HTMLButtonElement;
}

interface OptimizerEditionExportWorkflow {
	toggleExportMenu: () => void;
	closeExportMenu: () => void;
	exportByFormat: (format: string) => void;
}

export const createOptimizerEditionExportWorkflow = (
	options: CreateOptimizerEditionExportWorkflowOptions
): OptimizerEditionExportWorkflow => {
	const {
		resultPreview,
		cvPrimaryColorPicker,
		getSelectedTemplateId,
		getCurrentDocumentBaseName,
		setStatus,
		exportMenuList,
		exportMenuTrigger
	} = options;

	const closeExportMenu = (): void => {
		exportMenuList.hidden = true;
		exportMenuTrigger.setAttribute('aria-expanded', 'false');
	};

	const openExportMenu = (): void => {
		exportMenuList.hidden = false;
		exportMenuTrigger.setAttribute('aria-expanded', 'true');
	};

	const toggleExportMenu = (): void => {
		if (exportMenuList.hidden) {
			openExportMenu();
			return;
		}

		closeExportMenu();
	};

	const exportCurrentHtml = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

		const fileName = toSafeFileName(getCurrentDocumentBaseName(), 'html');
		const htmlDocument = buildHtmlExportDocument(
			resultPreview.innerHTML,
			cvPrimaryColorPicker.value,
			getSelectedTemplateId()
		);
		downloadTextFile(fileName, htmlDocument, 'text/html;charset=utf-8');
	};

	const exportCurrentTxt = (): void => {
		const plainText = resultPreview.innerText.trim();
		if (!plainText) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

		const fileName = toSafeFileName(getCurrentDocumentBaseName(), 'txt');
		downloadTextFile(fileName, plainText, 'text/plain;charset=utf-8');
	};

	const exportCurrentPdf = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

		const printableHtml = buildPrintableHtml(
			resultPreview.innerHTML,
			cvPrimaryColorPicker.value,
			getSelectedTemplateId()
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

	const exportByFormat = (format: string): void => {
		switch (format) {
			case 'html':
				exportCurrentHtml();
				return;
			case 'txt':
				exportCurrentTxt();
				return;
			case 'pdf':
				exportCurrentPdf();
				return;
			default:
				setStatus('error', 'Formato no soportado', 'Selecciona un formato de exportacion valido.');
		}
	};

	return {
		toggleExportMenu,
		closeExportMenu,
		exportByFormat
	};
};
