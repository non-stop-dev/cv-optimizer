import {
	buildHtmlExportDocument,
	buildPrintableHtmlEditable,
	buildPrintableHtmlSimple,
	buildWordExportDocument,
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

	const exportCurrentWord = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

		const fileName = toSafeFileName(getCurrentDocumentBaseName(), 'doc');
		const wordDocument = buildWordExportDocument(
			resultPreview.innerHTML,
			cvPrimaryColorPicker.value,
			getSelectedTemplateId()
		);
		downloadTextFile(fileName, wordDocument, 'application/msword');
	};

	const exportPdf = (
		printableHtml: string,
		statusMessage: string
	): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

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
			statusMessage
		);
	};

	const exportCurrentSimplePdf = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

		exportPdf(
			buildPrintableHtmlSimple(
				resultPreview.innerHTML,
				cvPrimaryColorPicker.value,
				getSelectedTemplateId()
			),
			'Se abrio una pestana de impresion para un PDF simple. Si no aparece el dialogo automatico, usa Cmd/Ctrl+P para guardar como PDF.'
		);
	};

	const exportCurrentEditablePdf = (): void => {
		if (!resultPreview.innerHTML.trim()) {
			setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
			return;
		}

		exportPdf(
			buildPrintableHtmlEditable(
				resultPreview.innerHTML,
				cvPrimaryColorPicker.value,
				getSelectedTemplateId()
			),
			'Se abrio una pestana de impresion para un PDF editable en CV Optimizer. Si no aparece el dialogo automatico, usa Cmd/Ctrl+P para guardar como PDF.'
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
			case 'word':
				exportCurrentWord();
				return;
			case 'pdf-simple':
				exportCurrentSimplePdf();
				return;
			case 'pdf-editable':
				exportCurrentEditablePdf();
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
