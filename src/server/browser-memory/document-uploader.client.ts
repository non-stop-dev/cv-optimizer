import { DEFAULT_CV_TEMPLATE_ID } from '../export-cv/cv-export';
import {
	createDocumentUploadExportWorkflow
} from './document-upload-export-workflow.client';
import {
	createDocumentUploadHistoryWorkflow
} from './document-upload-history.client';
import {
	createDocumentUploadResultPreview
} from './document-upload-result-preview.client';
import {
	createDocumentUploadStatusWorkflow
} from './document-upload-status.client';
import {
	createDocumentUploadTargetPositionsController,
	toTargetPositionsFromPayload
} from './document-upload-target-positions.client';
import { getDocumentUploaderDom } from './document-uploader-dom.client';
import {
	UploadFlowError,
	toFriendlyErrorMessage,
	toOptimizerResultPath,
	validateFileSelection
} from './document-uploader-shared';

const dom = getDocumentUploaderDom();
const statusWorkflow = createDocumentUploadStatusWorkflow({
	statusContainer: dom.statusContainer,
	statusTitle: dom.statusTitle,
	statusMessage: dom.statusMessage,
	statusLogList: dom.statusLogList,
	retryButton: dom.retryButton
});
const targetPositionsController = createDocumentUploadTargetPositionsController({
	input: dom.targetPositionInput,
	hiddenInput: dom.targetPositionsHiddenInput,
	chips: dom.targetPositionsChips,
	feedback: dom.targetPositionsFeedback
});
const historyWorkflow = createDocumentUploadHistoryWorkflow({
	historyList: dom.historyList,
	historyEmpty: dom.historyEmpty,
	historyClearButton: dom.historyClearButton
});
const resultPreview = createDocumentUploadResultPreview({
	resultContainer: dom.resultContainer,
	resultPreview: dom.resultPreview,
	resultRaw: dom.resultRaw,
	cvPrimaryColorPicker: dom.cvPrimaryColorPicker
});
const exportWorkflow = createDocumentUploadExportWorkflow({
	resultPreview: dom.resultPreview,
	cvPrimaryColorPicker: dom.cvPrimaryColorPicker,
	getCurrentDocumentBaseName: () => currentDocumentBaseName,
	setStatus: statusWorkflow.setStatus
});

let lastSelectedFile: File | null = null;
let currentDocumentBaseName = 'cv-optimizado';

const setLoadingState = (isLoading: boolean): void => {
	dom.input.disabled = isLoading;
	dom.submitButton.disabled = isLoading;
	dom.retryButton.disabled = isLoading;
	dom.submitButton.textContent = isLoading ? 'Generando...' : 'Generar CV optimizado';
	targetPositionsController.setBusy(isLoading);
};

const updateFileNameLabel = (): void => {
	const selectedFile = dom.input.files?.[0];
	if (selectedFile instanceof File) {
		lastSelectedFile = selectedFile;
		currentDocumentBaseName = selectedFile.name.replace(/\.[^.]+$/, '') || 'cv-optimizado';
	}

	dom.fileNameLabel.textContent = selectedFile ? selectedFile.name : 'No file chosen';
};

const uploadDocument = async (file: File | null | undefined): Promise<void> => {
	resultPreview.clearResult();
	statusWorkflow.clearLogs();
	statusWorkflow.setRetryAvailability(false);

	if (!(file instanceof File)) {
		statusWorkflow.setStatus(
			'error',
			'No se pudo subir',
			'Selecciona un documento e intenta nuevamente.'
		);
		statusWorkflow.appendLog('Selecciona un archivo para iniciar el proceso', 'error');
		return;
	}

	lastSelectedFile = file;
	currentDocumentBaseName = file.name.replace(/\.[^.]+$/, '') || 'cv-optimizado';
	dom.fileNameLabel.textContent = file.name;

	statusWorkflow.startStage('validating');
	const errorMessage = validateFileSelection(file);
	if (errorMessage) {
		statusWorkflow.setStatus('error', 'No se pudo subir', errorMessage);
		statusWorkflow.failActiveStage();
		statusWorkflow.appendLog('Proceso detenido', 'error');
		return;
	}

	statusWorkflow.completeStage('validating');
	targetPositionsController.flushPendingInput();
	const requestTargetPositions = targetPositionsController.getValues();

	setLoadingState(true);
	statusWorkflow.setStatus(
		'proceso',
		'Procesando CV',
		'Estamos trabajando en tu documento.'
	);
	statusWorkflow.startStage('uploading');

	try {
		const body = new FormData();
		body.append('document', file);
		body.append('targetPositions', JSON.stringify(requestTargetPositions));

		const response = await fetch('/api/upload', { method: 'POST', body });
		statusWorkflow.completeStage('uploading');
		statusWorkflow.startStage('optimizing');

		const payload = await response.json().catch(() => null);
		if (!response.ok || payload?.ok !== true) {
			statusWorkflow.failActiveStage();
			const backendMessage = payload?.error?.message;
			const backendCode = payload?.error?.code;
			if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
				throw new UploadFlowError(
					backendMessage,
					typeof backendCode === 'string'
						? backendCode
						: `HTTP_${response.status}`
				);
			}

			throw new UploadFlowError(
				toFriendlyErrorMessage(response.status),
				`HTTP_${response.status}`
			);
		}

		statusWorkflow.completeStage('optimizing');
		statusWorkflow.startStage('rendering');

		const optimizedHTML = payload?.data?.optimizedHTML;
		if (typeof optimizedHTML !== 'string' || optimizedHTML.trim().length === 0) {
			statusWorkflow.failActiveStage();
			throw new UploadFlowError('La respuesta de IA llego vacia.', 'AI_EMPTY_RESPONSE');
		}

		const normalizedTargetPositions = Array.isArray(payload?.data?.targetPositions)
			? toTargetPositionsFromPayload(payload.data.targetPositions)
			: requestTargetPositions;
		targetPositionsController.setValues(normalizedTargetPositions);
		resultPreview.showResult(optimizedHTML);

		let createdHistoryId: string | null = null;
		try {
			createdHistoryId = await historyWorkflow.saveCurrentVersion({
				sourceFileName: file.name,
				safeFileName:
					typeof payload?.data?.safeFileName === 'string'
						? payload.data.safeFileName
						: file.name,
				format:
					typeof payload?.data?.format === 'string' ? payload.data.format : 'txt',
				inputSizeInBytes: file.size,
				inputFile: file,
				summary:
					typeof payload?.data?.summary === 'string' ? payload.data.summary : '',
				contentHash:
					typeof payload?.data?.contentHash === 'string'
						? payload.data.contentHash
						: '',
				optimizedHTML,
				primaryColor: dom.cvPrimaryColorPicker.value,
				templateId: DEFAULT_CV_TEMPLATE_ID,
				targetPositions: normalizedTargetPositions
			});
		} catch (historyError) {
			console.error('No se pudo guardar la version en historial local.', historyError);
			statusWorkflow.appendLog(
				'No se pudo guardar esta version en historial local',
				'error'
			);
		}

		statusWorkflow.completeStage('rendering');
		statusWorkflow.setStatus(
			'exito',
			'Documento subido',
			'Tu CV se proceso correctamente y esta listo para optimizacion.'
		);
		statusWorkflow.appendLog('Proceso completado', 'completado');

		if (typeof createdHistoryId === 'string' && createdHistoryId.length > 0) {
			window.location.assign(toOptimizerResultPath(createdHistoryId));
		}
	} catch (error) {
		statusWorkflow.failActiveStage();
		const message =
			error instanceof Error
				? error.message
				: 'Ocurrio un error inesperado al procesar el archivo.';
		statusWorkflow.setStatus('error', 'No se pudo procesar', message);
		statusWorkflow.appendLog('Proceso detenido', 'error');

		const errorCode = error instanceof UploadFlowError ? error.code : 'UNKNOWN';
		if (errorCode === 'AI_PROVIDER_OVERLOADED') {
			statusWorkflow.setRetryAvailability(true);
		}
	} finally {
		setLoadingState(false);
	}
};

dom.input.addEventListener('change', updateFileNameLabel);
dom.resultPreview.addEventListener('input', () => {
	resultPreview.syncRawHtmlPanel();
});

dom.targetPositionInput.addEventListener('input', () => {
	targetPositionsController.consumeCommaInput();
});

dom.targetPositionInput.addEventListener('blur', () => {
	targetPositionsController.flushPendingInput();
});

dom.targetPositionInput.addEventListener('keydown', (event) => {
	if (event.key !== 'Enter') {
		return;
	}

	event.preventDefault();
	targetPositionsController.flushPendingInput();
});

dom.targetPositionsChips.addEventListener('click', (event) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) {
		return;
	}

	const removeButton = target.closest('[data-target-position-remove-index]');
	if (!(removeButton instanceof HTMLButtonElement) || removeButton.disabled) {
		return;
	}

	const index = Number.parseInt(
		removeButton.dataset.targetPositionRemoveIndex ?? '',
		10
	);
	targetPositionsController.removeAt(index);
	targetPositionsController.focusInput();
});

dom.cvPrimaryColorPicker.addEventListener('input', (event) => {
	const target = event.currentTarget;
	if (!(target instanceof HTMLInputElement)) {
		return;
	}

	resultPreview.applyPreviewPrimaryColor(target.value);
});

dom.exportHtmlButton.addEventListener('click', exportWorkflow.exportCurrentHtml);
dom.exportTxtButton.addEventListener('click', exportWorkflow.exportCurrentTxt);
dom.exportPdfButton.addEventListener('click', exportWorkflow.exportCurrentPdf);

dom.form.addEventListener('submit', async (event) => {
	event.preventDefault();
	targetPositionsController.flushPendingInput();
	const selectedFile = dom.input.files?.[0] ?? lastSelectedFile;
	await uploadDocument(selectedFile);
});

dom.retryButton.addEventListener('click', async () => {
	if (dom.submitButton.disabled) {
		return;
	}

	if (!(lastSelectedFile instanceof File)) {
		statusWorkflow.setStatus(
			'error',
			'No se pudo reintentar',
			'Selecciona nuevamente el documento para continuar.'
		);
		statusWorkflow.setRetryAvailability(false);
		return;
	}

	await uploadDocument(lastSelectedFile);
});

dom.historyList.addEventListener('click', (event) => {
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

	const selectedEntry = historyWorkflow.findEntryById(historyId);
	if (!selectedEntry) {
		statusWorkflow.setStatus(
			'error',
			'No se pudo cargar la version',
			'Esta version ya no esta disponible en historial.'
		);
		return;
	}

	window.location.assign(toOptimizerResultPath(selectedEntry.id));
});

dom.historyClearButton.addEventListener('click', async () => {
	if (historyWorkflow.getEntries().length === 0 || dom.historyClearButton.disabled) {
		return;
	}

	dom.historyClearButton.disabled = true;
	try {
		await historyWorkflow.clearHistory();
		statusWorkflow.clearLogs();
		statusWorkflow.appendLog('Historial local limpiado', 'completado');
		statusWorkflow.setStatus(
			'exito',
			'Historial limpio',
			'Se eliminaron todas las versiones guardadas.'
		);
	} catch (error) {
		console.error('No se pudo limpiar el historial local.', error);
		statusWorkflow.setStatus(
			'error',
			'No se pudo limpiar el historial',
			'Intenta nuevamente en unos segundos.'
		);
	} finally {
		dom.historyClearButton.disabled = historyWorkflow.getEntries().length === 0;
	}
});

targetPositionsController.setValues([]);
void historyWorkflow.refreshHistory();
