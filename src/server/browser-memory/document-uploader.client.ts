import {
	buildHtmlExportDocument,
	buildPrintableHtml,
	downloadTextFile,
	openPrintPreview,
	toSafeFileName
} from '../export-cv/cv-export';
import { createPreviewColorApplicator } from '../export-cv/cv-preview-color';
import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import {
	HISTORY_MAX_ENTRIES,
	PROCESS_STAGES,
	type StageKey,
	type StageState,
	UploadFlowError,
	toFriendlyErrorMessage,
	toOptimizerResultPath,
	validateFileSelection
} from './document-uploader-shared';
import { renderHistoryList } from './document-uploader-history-view';
import type { HistoryEntry } from './history-entry';
import { clearHistoryEntries, readHistoryEntries, writeHistoryEntry } from './history-db';

const PREVIEW_SELECTOR = '[data-upload-result-preview]';
const DEFAULT_PRIMARY_COLOR = '#0f766e';

type StatusTone = 'proceso' | 'exito' | 'error';

interface SaveHistoryPayload {
	sourceFileName: string;
	safeFileName: string;
	format: string;
	inputSizeInBytes: number;
	inputFile: File;
	summary: string;
	contentHash: string;
	optimizedHTML: string;
	primaryColor: string;
}

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
	!(exportPdfButton instanceof HTMLButtonElement)
) {
	throw new Error('No se pudo inicializar el componente de carga de documentos.');
}

const applyPreviewPrimaryColor = createPreviewColorApplicator(PREVIEW_SELECTOR, DEFAULT_PRIMARY_COLOR);
const stageNodes = new Map<StageKey, HTMLElement>();
let activeStageKey: StageKey | null = null;
let lastSelectedFile: File | null = null;
let currentDocumentBaseName = 'cv-optimizado';
let historyEntries: HistoryEntry[] = [];

const setStatus = (tone: StatusTone, title: string, message: string): void => {
	statusContainer.hidden = false;
	statusContainer.dataset.tone = tone;
	statusTitle.textContent = title;
	statusMessage.textContent = message;
};

const clearLogs = (): void => {
	stageNodes.clear();
	activeStageKey = null;
	statusLogList.innerHTML = '';
};

const setRetryAvailability = (isVisible: boolean): void => {
	retryButton.hidden = !isVisible;
};

const appendLog = (text: string, state: StageState): void => {
	const item = document.createElement('li');
	item.dataset.uploadLogItem = '';
	item.dataset.state = state;
	item.textContent = text;
	statusLogList.appendChild(item);
};

const startStage = (stageKey: StageKey): void => {
	const existing = stageNodes.get(stageKey);
	if (existing) {
		existing.dataset.state = 'en-progreso';
		activeStageKey = stageKey;
		return;
	}

	appendLog(PROCESS_STAGES[stageKey], 'en-progreso');
	const latestLog = statusLogList.lastElementChild;
	if (latestLog instanceof HTMLElement) {
		stageNodes.set(stageKey, latestLog);
		activeStageKey = stageKey;
	}
};

const completeStage = (stageKey: StageKey): void => {
	const stageNode = stageNodes.get(stageKey);
	if (!(stageNode instanceof HTMLElement)) {
		return;
	}

	stageNode.dataset.state = 'completado';
	if (activeStageKey === stageKey) {
		activeStageKey = null;
	}
};

const failActiveStage = (): void => {
	if (!activeStageKey) {
		return;
	}

	const stageNode = stageNodes.get(activeStageKey);
	if (stageNode instanceof HTMLElement) {
		stageNode.dataset.state = 'error';
	}
	activeStageKey = null;
};

const clearResult = (): void => {
	resultContainer.hidden = true;
	resultPreview.innerHTML = '';
	resultRaw.textContent = '';
};

const syncRawHtmlPanel = (): void => {
	resultRaw.textContent = resultPreview.innerHTML;
};

const showResult = (optimizedHTML: string): void => {
	const safeOptimizedHtml = sanitizeCvHtml(optimizedHTML);
	if (!safeOptimizedHtml.trim()) {
		throw new UploadFlowError(
			'El contenido optimizado no paso la sanitizacion del navegador.',
			'UNSAFE_HTML'
		);
	}

	resultContainer.hidden = false;
	resultPreview.innerHTML = safeOptimizedHtml;
	applyPreviewPrimaryColor(cvPrimaryColorPicker.value);
	syncRawHtmlPanel();
};

const renderHistory = (): void => {
	renderHistoryList({
		historyList,
		historyEmpty,
		historyClearButton,
		entries: historyEntries
	});
};

const refreshHistory = async (): Promise<void> => {
	try {
		historyEntries = await readHistoryEntries();
		renderHistory();
	} catch (error) {
		historyEntries = [];
		renderHistory();
		console.error('No se pudo cargar el historial local.', error);
	}
};

const saveCurrentVersionToHistory = async ({
	sourceFileName,
	safeFileName,
	format,
	inputSizeInBytes,
	inputFile,
	summary,
	contentHash,
	optimizedHTML,
	primaryColor
}: SaveHistoryPayload): Promise<string> => {
	const safeOptimizedHtml = sanitizeCvHtml(optimizedHTML);
	if (!safeOptimizedHtml.trim()) {
		throw new Error('No se puede guardar una version no segura o vacia.');
	}

	const historyId = crypto.randomUUID();

	await writeHistoryEntry(
		{
			id: historyId,
			createdAt: Date.now(),
			sourceFileName,
			safeFileName,
			format,
			inputSizeInBytes,
			inputFile,
			summary,
			contentHash,
			optimizedHTML: safeOptimizedHtml,
			primaryColor
		},
		HISTORY_MAX_ENTRIES
	);
	await refreshHistory();
	return historyId;
};

const setLoadingState = (isLoading: boolean): void => {
	input.disabled = isLoading;
	submitButton.disabled = isLoading;
	retryButton.disabled = isLoading;
	submitButton.textContent = isLoading ? 'Subiendo...' : 'Subir';
};

const updateFileNameLabel = (): void => {
	const selectedFile = input.files?.[0];
	if (selectedFile instanceof File) {
		lastSelectedFile = selectedFile;
		currentDocumentBaseName = selectedFile.name.replace(/\.[^.]+$/, '') || 'cv-optimizado';
	}
	fileNameLabel.textContent = selectedFile ? selectedFile.name : 'No file chosen';
};

const exportCurrentHtml = (): void => {
	if (!resultPreview.innerHTML.trim()) {
		setStatus('error', 'No hay contenido para exportar', 'Genera o edita un CV antes de exportar.');
		return;
	}

	const fileName = toSafeFileName(currentDocumentBaseName, 'html');
	const htmlDocument = buildHtmlExportDocument(resultPreview.innerHTML, cvPrimaryColorPicker.value);
	downloadTextFile(fileName, htmlDocument, 'text/html;charset=utf-8');
};

const exportCurrentTxt = (): void => {
	const plainText = resultPreview.innerText.trim();
	if (!plainText) {
		setStatus('error', 'No hay contenido para exportar', 'Genera o edita un CV antes de exportar.');
		return;
	}

	const fileName = toSafeFileName(currentDocumentBaseName, 'txt');
	downloadTextFile(fileName, plainText, 'text/plain;charset=utf-8');
};

const exportCurrentPdf = (): void => {
	if (!resultPreview.innerHTML.trim()) {
		setStatus('error', 'No hay contenido para exportar', 'Genera o edita un CV antes de exportar.');
		return;
	}

	const printableHtml = buildPrintableHtml(resultPreview.innerHTML, cvPrimaryColorPicker.value);
	const opened = openPrintPreview(printableHtml);
	if (!opened) {
		setStatus(
			'error',
			'No se pudo abrir la vista de impresion',
			'Tu navegador bloqueó la ventana emergente. Habilita pop-ups e intenta nuevamente.'
		);
		return;
	}

	setStatus(
		'proceso',
		'PDF listo para imprimir',
		'Se abrió una pestaña de impresión. Si no aparece el diálogo automático, usa Cmd/Ctrl+P para guardar como PDF.'
	);
};

const uploadDocument = async (file: File | null | undefined): Promise<void> => {
	clearResult();
	clearLogs();
	setRetryAvailability(false);

	if (!(file instanceof File)) {
		setStatus('error', 'No se pudo subir', 'Selecciona un documento e intenta nuevamente.');
		appendLog('Selecciona un archivo para iniciar el proceso', 'error');
		return;
	}

	lastSelectedFile = file;
	currentDocumentBaseName = file.name.replace(/\.[^.]+$/, '') || 'cv-optimizado';
	fileNameLabel.textContent = file.name;

	startStage('validating');
	const errorMessage = validateFileSelection(file);
	if (errorMessage) {
		setStatus('error', 'No se pudo subir', errorMessage);
		failActiveStage();
		appendLog('Proceso detenido', 'error');
		return;
	}
	completeStage('validating');

	setLoadingState(true);
	setStatus('proceso', 'Procesando CV', 'Estamos trabajando en tu documento.');
	startStage('uploading');

	try {
		const body = new FormData();
		body.append('document', file);

		const response = await fetch('/api/upload', { method: 'POST', body });
		completeStage('uploading');
		startStage('optimizing');

		const payload = await response.json().catch(() => null);
		if (!response.ok || payload?.ok !== true) {
			failActiveStage();
			const backendMessage = payload?.error?.message;
			const backendCode = payload?.error?.code;
			if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
				throw new UploadFlowError(
					backendMessage,
					typeof backendCode === 'string' ? backendCode : `HTTP_${response.status}`
				);
			}
			throw new UploadFlowError(toFriendlyErrorMessage(response.status), `HTTP_${response.status}`);
		}

		completeStage('optimizing');
		startStage('rendering');

		const optimizedHTML = payload?.data?.optimizedHTML;
		if (typeof optimizedHTML !== 'string' || optimizedHTML.trim().length === 0) {
			failActiveStage();
			throw new UploadFlowError('La respuesta de IA llego vacia.', 'AI_EMPTY_RESPONSE');
		}

		showResult(optimizedHTML);

		let createdHistoryId: string | null = null;
		try {
			createdHistoryId = await saveCurrentVersionToHistory({
				sourceFileName: file.name,
				safeFileName:
					typeof payload?.data?.safeFileName === 'string' ? payload.data.safeFileName : file.name,
				format: typeof payload?.data?.format === 'string' ? payload.data.format : 'txt',
				inputSizeInBytes: file.size,
				inputFile: file,
				summary: typeof payload?.data?.summary === 'string' ? payload.data.summary : '',
				contentHash: typeof payload?.data?.contentHash === 'string' ? payload.data.contentHash : '',
				optimizedHTML,
				primaryColor: cvPrimaryColorPicker.value
			});
		} catch (historyError) {
			console.error('No se pudo guardar la version en historial local.', historyError);
			appendLog('No se pudo guardar esta version en historial local', 'error');
		}

		completeStage('rendering');
		setStatus('exito', 'Documento subido', 'Tu CV se proceso correctamente y esta listo para optimizacion.');
		appendLog('Proceso completado', 'completado');

		if (typeof createdHistoryId === 'string' && createdHistoryId.length > 0) {
			window.location.assign(toOptimizerResultPath(createdHistoryId));
		}
	} catch (error) {
		failActiveStage();
		const message =
			error instanceof Error ? error.message : 'Ocurrio un error inesperado al procesar el archivo.';
		setStatus('error', 'No se pudo procesar', message);
		appendLog('Proceso detenido', 'error');

		const errorCode = error instanceof UploadFlowError ? error.code : 'UNKNOWN';
		if (errorCode === 'AI_PROVIDER_OVERLOADED') {
			setRetryAvailability(true);
		}
	} finally {
		setLoadingState(false);
	}
};

input.addEventListener('change', updateFileNameLabel);
resultPreview.addEventListener('input', syncRawHtmlPanel);

cvPrimaryColorPicker.addEventListener('input', (event) => {
	const target = event.currentTarget;
	if (!(target instanceof HTMLInputElement)) {
		return;
	}

	applyPreviewPrimaryColor(target.value);
});

exportHtmlButton.addEventListener('click', exportCurrentHtml);
exportTxtButton.addEventListener('click', exportCurrentTxt);
exportPdfButton.addEventListener('click', exportCurrentPdf);

form.addEventListener('submit', async (event) => {
	event.preventDefault();
	const selectedFile = input.files?.[0] ?? lastSelectedFile;
	await uploadDocument(selectedFile);
});

retryButton.addEventListener('click', async () => {
	if (submitButton.disabled) {
		return;
	}
	if (!(lastSelectedFile instanceof File)) {
		setStatus('error', 'No se pudo reintentar', 'Selecciona nuevamente el documento para continuar.');
		setRetryAvailability(false);
		return;
	}

	await uploadDocument(lastSelectedFile);
});

historyList.addEventListener('click', (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) {
		return;
	}

	const loadButton = target.closest('[data-history-load-id]');
	if (!(loadButton instanceof HTMLButtonElement)) {
		return;
	}

	const historyId = loadButton.dataset.historyLoadId;
	if (typeof historyId !== 'string' || historyId.length === 0) {
		return;
	}

	const selectedEntry = historyEntries.find((entry) => entry.id === historyId);
	if (!selectedEntry) {
		setStatus('error', 'No se pudo cargar la version', 'Esta version ya no esta disponible en historial.');
		return;
	}

	window.location.assign(toOptimizerResultPath(historyId));
});

historyClearButton.addEventListener('click', async () => {
	if (historyEntries.length === 0 || historyClearButton.disabled) {
		return;
	}

	historyClearButton.disabled = true;
	try {
		await clearHistoryEntries();
		historyEntries = [];
		renderHistory();
		clearLogs();
		appendLog('Historial local limpiado', 'completado');
		setStatus('exito', 'Historial limpio', 'Se eliminaron todas las versiones guardadas.');
	} catch (error) {
		console.error('No se pudo limpiar el historial local.', error);
		setStatus('error', 'No se pudo limpiar el historial', 'Intenta nuevamente en unos segundos.');
	} finally {
		historyClearButton.disabled = historyEntries.length === 0;
	}
});

void refreshHistory();
