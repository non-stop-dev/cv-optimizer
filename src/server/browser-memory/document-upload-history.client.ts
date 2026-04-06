import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import type { OptimizeCvProcessingMode } from '../llm-processing/ai-provider-types';
import { renderHistoryList } from './document-uploader-history-view';
import { HISTORY_MAX_ENTRIES } from './document-uploader-shared';
import {
	normalizeHistoryEntryProcessingMode,
	normalizeHistoryEntryProcessingNotice,
	normalizeHistoryEntryTargetPositions,
	type HistoryEntry
} from './history-entry';
import {
	clearHistoryEntries,
	readHistoryEntries,
	writeHistoryEntry
} from './history-db';

export interface DocumentUploadSaveHistoryPayload {
	sourceFileName: string;
	safeFileName: string;
	format: string;
	inputSizeInBytes: number;
	inputFile: File;
	summary: string;
	contentHash: string;
	optimizedHTML: string;
	primaryColor: string;
	templateId: HistoryEntry['templateId'];
	targetPositions: string[];
	processingMode?: OptimizeCvProcessingMode;
	processingNotice?: string;
}

interface CreateDocumentUploadHistoryWorkflowOptions {
	historyList: HTMLElement;
	historyEmpty: HTMLElement;
	historyClearButton: HTMLButtonElement;
}

interface DocumentUploadHistoryWorkflow {
	refreshHistory: () => Promise<void>;
	saveCurrentVersion: (payload: DocumentUploadSaveHistoryPayload) => Promise<string>;
	clearHistory: () => Promise<void>;
	getEntries: () => HistoryEntry[];
	findEntryById: (historyId: string) => HistoryEntry | undefined;
}

/**
 * Coordinates browser-memory reads and writes for uploaded CV versions.
 */
export const createDocumentUploadHistoryWorkflow = (
	options: CreateDocumentUploadHistoryWorkflowOptions
): DocumentUploadHistoryWorkflow => {
	const { historyList, historyEmpty, historyClearButton } = options;
	let historyEntries: HistoryEntry[] = [];

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

	const saveCurrentVersion = async (
		payload: DocumentUploadSaveHistoryPayload
	): Promise<string> => {
		const safeOptimizedHtml = sanitizeCvHtml(payload.optimizedHTML);
		if (!safeOptimizedHtml.trim()) {
			throw new Error('No se puede guardar una version no segura o vacia.');
		}

		const historyId = crypto.randomUUID();
		await writeHistoryEntry(
			{
				id: historyId,
				createdAt: Date.now(),
				sourceFileName: payload.sourceFileName,
				safeFileName: payload.safeFileName,
				format: payload.format,
				inputSizeInBytes: payload.inputSizeInBytes,
				inputFile: payload.inputFile,
				summary: payload.summary,
				contentHash: payload.contentHash,
				optimizedHTML: safeOptimizedHtml,
				primaryColor: payload.primaryColor,
				templateId: payload.templateId,
				targetPositions: normalizeHistoryEntryTargetPositions(payload.targetPositions),
				processingMode: normalizeHistoryEntryProcessingMode(payload.processingMode),
				processingNotice: normalizeHistoryEntryProcessingNotice(payload.processingNotice)
			},
			HISTORY_MAX_ENTRIES
		);
		await refreshHistory();
		return historyId;
	};

	const clearHistory = async (): Promise<void> => {
		await clearHistoryEntries();
		historyEntries = [];
		renderHistory();
	};

	return {
		refreshHistory,
		saveCurrentVersion,
		clearHistory,
		getEntries: () => historyEntries,
		findEntryById: (historyId: string) =>
			historyEntries.find((entry) => entry.id === historyId)
	};
};
