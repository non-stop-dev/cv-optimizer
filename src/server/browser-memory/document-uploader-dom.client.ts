export interface DocumentUploaderDom {
	form: HTMLFormElement;
	input: HTMLInputElement;
	fileNameLabel: HTMLElement;
	submitButton: HTMLButtonElement;
	retryButton: HTMLButtonElement;
	statusContainer: HTMLElement;
	statusTitle: HTMLElement;
	statusMessage: HTMLElement;
	statusLogList: HTMLElement;
	resultContainer: HTMLElement;
	resultPreview: HTMLElement;
	resultRaw: HTMLElement;
	historyList: HTMLElement;
	historyEmpty: HTMLElement;
	historyClearButton: HTMLButtonElement;
	cvPrimaryColorPicker: HTMLInputElement;
	exportHtmlButton: HTMLButtonElement;
	exportTxtButton: HTMLButtonElement;
	exportPdfButton: HTMLButtonElement;
	targetPositionInput: HTMLInputElement;
	targetPositionsHiddenInput: HTMLInputElement;
	targetPositionsChips: HTMLElement;
	targetPositionsFeedback: HTMLElement;
}

/**
 * Reads and validates the upload workspace DOM once so the upload workflow can
 * stay focused on browser-memory behavior instead of query boilerplate.
 */
export const getDocumentUploaderDom = (): DocumentUploaderDom => {
	const form = document.querySelector('[data-upload-form]');
	const input = document.querySelector('[data-upload-input]');
	const fileNameLabel = document.querySelector('[data-upload-file-name]');
	const submitButton = document.querySelector('[data-upload-submit]');
	const retryButton = document.querySelector('[data-upload-retry]');
	const statusContainer = document.querySelector('[data-upload-status]');
	const statusTitle = document.querySelector('[data-upload-status-title]');
	const statusMessage = document.querySelector('[data-upload-status-message]');
	const statusLogList = document.querySelector('[data-upload-log-list]');
	const resultContainer = document.querySelector('[data-upload-result]');
	const resultPreview = document.querySelector('[data-upload-result-preview]');
	const resultRaw = document.querySelector('[data-upload-result-raw]');
	const historyList = document.querySelector('[data-upload-history-list]');
	const historyEmpty = document.querySelector('[data-upload-history-empty]');
	const historyClearButton = document.querySelector('[data-upload-history-clear]');
	const cvPrimaryColorPicker = document.querySelector('[data-cv-primary-color]');
	const exportHtmlButton = document.querySelector('[data-cv-export-html]');
	const exportTxtButton = document.querySelector('[data-cv-export-txt]');
	const exportPdfButton = document.querySelector('[data-cv-export-pdf]');
	const targetPositionInput = document.querySelector('[data-target-position-input]');
	const targetPositionsHiddenInput = document.querySelector('[data-target-positions-hidden]');
	const targetPositionsChips = document.querySelector('[data-target-positions-chips]');
	const targetPositionsFeedback = document.querySelector('[data-target-positions-feedback]');

	if (
		!(form instanceof HTMLFormElement) ||
		!(input instanceof HTMLInputElement) ||
		!(fileNameLabel instanceof HTMLElement) ||
		!(submitButton instanceof HTMLButtonElement) ||
		!(retryButton instanceof HTMLButtonElement) ||
		!(statusContainer instanceof HTMLElement) ||
		!(statusTitle instanceof HTMLElement) ||
		!(statusMessage instanceof HTMLElement) ||
		!(statusLogList instanceof HTMLElement) ||
		!(resultContainer instanceof HTMLElement) ||
		!(resultPreview instanceof HTMLElement) ||
		!(resultRaw instanceof HTMLElement) ||
		!(historyList instanceof HTMLElement) ||
		!(historyEmpty instanceof HTMLElement) ||
		!(historyClearButton instanceof HTMLButtonElement) ||
		!(cvPrimaryColorPicker instanceof HTMLInputElement) ||
		!(exportHtmlButton instanceof HTMLButtonElement) ||
		!(exportTxtButton instanceof HTMLButtonElement) ||
		!(exportPdfButton instanceof HTMLButtonElement) ||
		!(targetPositionInput instanceof HTMLInputElement) ||
		!(targetPositionsHiddenInput instanceof HTMLInputElement) ||
		!(targetPositionsChips instanceof HTMLElement) ||
		!(targetPositionsFeedback instanceof HTMLElement)
	) {
		throw new Error('No se pudo inicializar el componente de carga de documentos.');
	}

	return {
		form,
		input,
		fileNameLabel,
		submitButton,
		retryButton,
		statusContainer,
		statusTitle,
		statusMessage,
		statusLogList,
		resultContainer,
		resultPreview,
		resultRaw,
		historyList,
		historyEmpty,
		historyClearButton,
		cvPrimaryColorPicker,
		exportHtmlButton,
		exportTxtButton,
		exportPdfButton,
		targetPositionInput,
		targetPositionsHiddenInput,
		targetPositionsChips,
		targetPositionsFeedback
	};
};
