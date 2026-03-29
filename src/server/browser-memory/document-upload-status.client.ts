import {
	PROCESS_STAGES,
	type StageKey,
	type StageState
} from './document-uploader-shared';

export type DocumentUploadStatusTone = 'proceso' | 'exito' | 'error';

interface CreateDocumentUploadStatusWorkflowOptions {
	statusContainer: HTMLElement;
	statusTitle: HTMLElement;
	statusMessage: HTMLElement;
	statusLogList: HTMLElement;
	retryButton: HTMLButtonElement;
}

interface DocumentUploadStatusWorkflow {
	setStatus: (tone: DocumentUploadStatusTone, title: string, message: string) => void;
	clearLogs: () => void;
	setRetryAvailability: (isVisible: boolean) => void;
	appendLog: (text: string, state: StageState) => void;
	startStage: (stageKey: StageKey) => void;
	completeStage: (stageKey: StageKey) => void;
	failActiveStage: () => void;
}

/**
 * Centralizes status messaging and stage logs for the upload flow.
 */
export const createDocumentUploadStatusWorkflow = (
	options: CreateDocumentUploadStatusWorkflowOptions
): DocumentUploadStatusWorkflow => {
	const { statusContainer, statusTitle, statusMessage, statusLogList, retryButton } = options;
	const stageNodes = new Map<StageKey, HTMLElement>();
	let activeStageKey: StageKey | null = null;

	const setStatus = (
		tone: DocumentUploadStatusTone,
		title: string,
		message: string
	): void => {
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

	return {
		setStatus,
		clearLogs,
		setRetryAvailability,
		appendLog,
		startStage,
		completeStage,
		failActiveStage
	};
};
