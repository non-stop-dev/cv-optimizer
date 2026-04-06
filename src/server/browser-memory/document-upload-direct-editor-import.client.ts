import { DEFAULT_CV_TEMPLATE_ID } from '../export-cv/cv-export';
import {
	type StageKey,
	type StageState,
	UploadFlowError,
	toFriendlyErrorMessage,
	validateDirectEditorImportFile
} from './document-uploader-shared';
import type { DocumentUploadStatusTone } from './document-upload-status.client';
import type { DocumentUploadSaveHistoryPayload } from './document-upload-history.client';

interface CreateDocumentUploadDirectEditorImportWorkflowOptions {
	getPrimaryColor: () => string;
	showResult: (optimizedHTML: string) => void;
	saveCurrentVersion: (payload: DocumentUploadSaveHistoryPayload) => Promise<string>;
	setLoadingState: (isLoading: boolean) => void;
	setStatus: (
		tone: DocumentUploadStatusTone,
		title: string,
		message: string
	) => void;
	clearLogs: () => void;
	setRetryAvailability: (isVisible: boolean) => void;
	appendLog: (text: string, state: StageState) => void;
	startStage: (stageKey: StageKey) => void;
	completeStage: (stageKey: StageKey) => void;
	failActiveStage: () => void;
}

interface DocumentUploadDirectEditorImportWorkflow {
	importDocumentToEditor: (file: File | null | undefined) => Promise<string | null>;
}

/**
 * Imports PDF/HTML documents directly into browser-memory so the dedicated
 * editor can open them without involving the optimization API.
 */
export const createDocumentUploadDirectEditorImportWorkflow = (
	options: CreateDocumentUploadDirectEditorImportWorkflowOptions
): DocumentUploadDirectEditorImportWorkflow => {
	const {
		getPrimaryColor,
		showResult,
		saveCurrentVersion,
		setLoadingState,
		setStatus,
		clearLogs,
		setRetryAvailability,
		appendLog,
		startStage,
		completeStage,
		failActiveStage
	} = options;

	const importDocumentToEditor = async (
		file: File | null | undefined
	): Promise<string | null> => {
		clearLogs();
		setRetryAvailability(false);

		if (!(file instanceof File)) {
			setStatus(
				'error',
				'No se pudo importar',
				'Selecciona un PDF o un HTML e intenta nuevamente.'
			);
			appendLog('Selecciona un archivo para abrir el editor', 'error');
			return null;
		}

		startStage('validating');
		const errorMessage = validateDirectEditorImportFile(file);
		if (errorMessage) {
			setStatus('error', 'No se pudo importar', errorMessage);
			failActiveStage();
			appendLog('Proceso detenido', 'error');
			return null;
		}

		completeStage('validating');
		setLoadingState(true);
		setStatus(
			'proceso',
			'Preparando editor',
			'Estamos creando una version editable sin usar la IA.'
		);
		startStage('importing');

		try {
			const body = new FormData();
			body.append('document', file);

			const response = await fetch('/api/editor-import', { method: 'POST', body });
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.ok !== true) {
				failActiveStage();
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

			completeStage('importing');
			startStage('rendering');

			const optimizedHTML = payload?.data?.optimizedHTML;
			if (typeof optimizedHTML !== 'string' || optimizedHTML.trim().length === 0) {
				failActiveStage();
				throw new UploadFlowError(
					'La importacion directa llego vacia.',
					'EDITOR_IMPORT_EMPTY_RESPONSE'
				);
			}

			showResult(optimizedHTML);

			const createdHistoryId = await saveCurrentVersion({
				sourceFileName: file.name,
				safeFileName:
					typeof payload?.data?.safeFileName === 'string'
						? payload.data.safeFileName
						: file.name,
				format:
					typeof payload?.data?.format === 'string'
						? payload.data.format
						: file.name.toLowerCase().endsWith('.pdf')
							? 'pdf'
							: 'html',
				inputSizeInBytes: file.size,
				inputFile: file,
				summary:
					typeof payload?.data?.summary === 'string' ? payload.data.summary : '',
				contentHash:
					typeof payload?.data?.contentHash === 'string'
						? payload.data.contentHash
						: '',
				optimizedHTML,
				primaryColor: getPrimaryColor(),
				templateId: DEFAULT_CV_TEMPLATE_ID,
				targetPositions: []
			});

			completeStage('rendering');
			setStatus(
				'exito',
				'Editor listo',
				typeof payload?.data?.importNotice === 'string'
					? payload.data.importNotice
					: 'Se preparo una version editable sin usar la IA.'
			);
			appendLog('Proceso completado', 'completado');
			return createdHistoryId;
		} catch (error) {
			failActiveStage();
			const message =
				error instanceof Error
					? error.message
					: 'Ocurrio un error inesperado al importar el archivo.';
			setStatus('error', 'No se pudo importar', message);
			appendLog('Proceso detenido', 'error');
			return null;
		} finally {
			setLoadingState(false);
		}
	};

	return {
		importDocumentToEditor
	};
};
