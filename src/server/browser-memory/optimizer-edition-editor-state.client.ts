import { toCvTemplateId, type CvTemplateId } from '../export-cv/cv-export';
import {
	createPreviewColorApplicator,
	isValidHexColor
} from '../export-cv/cv-preview-color';
import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import {
	createUndoRedoController,
	type EditorSnapshot
} from './editor-undo-redo';
import type { HistoryEntry } from './history-entry';
import {
	readHistoryEntryById,
	upsertHistoryEntry
} from './history-db';
import type { OptimizerEditionViewDom } from './optimizer-edition-view-dom.client';

const PREVIEW_SELECTOR = '[data-output-preview]';
const DEFAULT_PRIMARY_COLOR = '#0f766e';
const AUTOSAVE_DEBOUNCE_MS = 500;
const SNAPSHOT_DEBOUNCE_MS = 220;
const UNDO_REDO_RETENTION_MS = 20 * 60 * 1000;
const MAX_UNDO_REDO_SNAPSHOTS = 1200;

export type OptimizerEditionStatusTone = 'proceso' | 'exito' | 'error';

type SaveIndicatorState = 'idle' | 'saving' | 'saved' | 'error';

interface CreateOptimizerEditionEditorStateControllerOptions {
	dom: OptimizerEditionViewDom;
}

interface OptimizerEditionEditorStateController {
	setStatus: (tone: OptimizerEditionStatusTone, title: string, message: string) => void;
	getSelectedTemplateId: () => CvTemplateId;
	getCurrentDocumentBaseName: () => string;
	getEditorSnapshot: () => EditorSnapshot | null;
	onEditorInputChange: () => void;
	applySelectedColor: (nextColor: string) => void;
	applySelectedTemplate: (nextTemplate: string) => void;
	applyTranslatedHtmlToEditor: (safeTranslatedHtml: string) => void;
	performUndo: () => void;
	performRedo: () => void;
	flushAutosave: () => void;
	isEditorShortcutContext: (target: EventTarget | null) => boolean;
	loadEntry: (entryId: string) => Promise<void>;
}

/**
 * Keeps optimizer-edition browser-memory state, autosave, and undo/redo
 * responsibilities isolated from UI event wiring.
 */
export const createOptimizerEditionEditorStateController = (
	options: CreateOptimizerEditionEditorStateControllerOptions
): OptimizerEditionEditorStateController => {
	const { dom } = options;
	const applyPreviewPrimaryColor = createPreviewColorApplicator(
		PREVIEW_SELECTOR,
		DEFAULT_PRIMARY_COLOR
	);
	const undoRedo = createUndoRedoController({
		retentionMs: UNDO_REDO_RETENTION_MS,
		maxSnapshots: MAX_UNDO_REDO_SNAPSHOTS
	});

	let currentEntry: HistoryEntry | null = null;
	let currentDocumentBaseName = 'cv-optimizado';
	let autosaveTimer: number | null = null;
	let snapshotTimer: number | null = null;
	let applyingSnapshot = false;

	const setSaveIndicator = (state: SaveIndicatorState, message: string): void => {
		dom.outputSaveIndicator.dataset.state = state;
		dom.outputSaveIndicator.textContent = message;
	};

	const setStatus = (
		tone: OptimizerEditionStatusTone,
		title: string,
		message: string
	): void => {
		dom.statusContainer.hidden = false;
		dom.statusContainer.dataset.tone = tone;
		dom.statusTitle.textContent = title;
		dom.statusMessage.textContent = message;
	};

	const syncRawHtmlPanel = (): void => {
		dom.resultRaw.textContent = dom.resultPreview.innerHTML;
	};

	const getSelectedTemplateId = (): CvTemplateId => {
		const normalizedTemplate = toCvTemplateId(dom.cvTemplateSelect.value);
		if (dom.cvTemplateSelect.value !== normalizedTemplate) {
			dom.cvTemplateSelect.value = normalizedTemplate;
		}

		return normalizedTemplate;
	};

	const applyPreviewTemplate = (templateId: CvTemplateId): void => {
		dom.resultPreview.dataset.cvTemplate = templateId;
	};

	const updateUndoRedoButtons = (): void => {
		dom.undoButton.disabled = !undoRedo.canUndo();
		dom.redoButton.disabled = !undoRedo.canRedo();
	};

	const showResult = (optimizedHTML: string): void => {
		const safeOptimizedHtml = sanitizeCvHtml(optimizedHTML);
		if (!safeOptimizedHtml.trim()) {
			throw new Error('El contenido optimizado no paso la sanitizacion del navegador.');
		}

		dom.resultContainer.hidden = false;
		dom.resultPreview.innerHTML = safeOptimizedHtml;
		applyPreviewTemplate(getSelectedTemplateId());
		applyPreviewPrimaryColor(dom.cvPrimaryColorPicker.value);
		syncRawHtmlPanel();
	};

	const getEditorSnapshot = (): EditorSnapshot | null => {
		const safeOptimizedHtml = sanitizeCvHtml(dom.resultPreview.innerHTML);
		if (!safeOptimizedHtml.trim()) {
			return null;
		}

		const nextColor = isValidHexColor(dom.cvPrimaryColorPicker.value)
			? dom.cvPrimaryColorPicker.value
			: DEFAULT_PRIMARY_COLOR;

		return {
			optimizedHTML: safeOptimizedHtml,
			primaryColor: nextColor,
			templateId: getSelectedTemplateId(),
			timestamp: Date.now()
		};
	};

	const captureSnapshotNow = (): void => {
		if (applyingSnapshot) {
			return;
		}

		const snapshot = getEditorSnapshot();
		if (!snapshot) {
			return;
		}

		undoRedo.captureSnapshot(snapshot);
		updateUndoRedoButtons();
	};

	const scheduleSnapshotCapture = (): void => {
		if (snapshotTimer !== null) {
			window.clearTimeout(snapshotTimer);
		}

		snapshotTimer = window.setTimeout(() => {
			snapshotTimer = null;
			captureSnapshotNow();
		}, SNAPSHOT_DEBOUNCE_MS);
	};

	const flushSnapshotCapture = (): void => {
		if (snapshotTimer === null) {
			return;
		}

		window.clearTimeout(snapshotTimer);
		snapshotTimer = null;
		captureSnapshotNow();
	};

	const persistCurrentEntry = async (): Promise<void> => {
		if (!currentEntry) {
			return;
		}

		const snapshot = getEditorSnapshot();
		if (!snapshot) {
			setSaveIndicator('error', 'No se guardo: contenido vacio o inseguro.');
			return;
		}

		const updatedEntry: HistoryEntry = {
			...currentEntry,
			optimizedHTML: snapshot.optimizedHTML,
			primaryColor: snapshot.primaryColor,
			templateId: snapshot.templateId
		};

		try {
			await upsertHistoryEntry(updatedEntry);
			currentEntry = updatedEntry;
			setSaveIndicator('saved', 'Autoguardado');
		} catch (error) {
			console.error('No se pudo autoguardar la version editada.', error);
			setSaveIndicator('error', 'No se pudieron guardar cambios locales.');
		}
	};

	const scheduleAutosave = (): void => {
		if (!currentEntry) {
			return;
		}

		if (autosaveTimer !== null) {
			window.clearTimeout(autosaveTimer);
		}

		setSaveIndicator('saving', 'Guardando cambios...');
		autosaveTimer = window.setTimeout(() => {
			autosaveTimer = null;
			void persistCurrentEntry();
		}, AUTOSAVE_DEBOUNCE_MS);
	};

	const onEditorInputChange = (): void => {
		if (applyingSnapshot) {
			return;
		}

		syncRawHtmlPanel();
		scheduleSnapshotCapture();
		scheduleAutosave();
	};

	const syncEditorStateAfterProgrammaticChange = (): void => {
		syncRawHtmlPanel();
		captureSnapshotNow();
		updateUndoRedoButtons();
		scheduleAutosave();
	};

	const applyEditorSnapshot = (snapshot: EditorSnapshot): void => {
		applyingSnapshot = true;
		dom.cvPrimaryColorPicker.value = snapshot.primaryColor;
		dom.cvTemplateSelect.value = snapshot.templateId;
		applyPreviewTemplate(snapshot.templateId);
		showResult(snapshot.optimizedHTML);
		applyPreviewPrimaryColor(snapshot.primaryColor);
		applyingSnapshot = false;
		scheduleAutosave();
	};

	const performUndo = (): void => {
		flushSnapshotCapture();
		const snapshot = undoRedo.undo();
		if (!snapshot) {
			return;
		}

		applyEditorSnapshot(snapshot);
		updateUndoRedoButtons();
	};

	const performRedo = (): void => {
		flushSnapshotCapture();
		const snapshot = undoRedo.redo();
		if (!snapshot) {
			return;
		}

		applyEditorSnapshot(snapshot);
		updateUndoRedoButtons();
	};

	const flushAutosave = (): void => {
		flushSnapshotCapture();
		if (autosaveTimer === null) {
			return;
		}

		window.clearTimeout(autosaveTimer);
		autosaveTimer = null;
		void persistCurrentEntry();
	};

	const isEditorShortcutContext = (target: EventTarget | null): boolean => {
		if (target instanceof Node && dom.resultContainer.contains(target)) {
			return true;
		}

		const active = document.activeElement;
		if (active instanceof Node && dom.resultContainer.contains(active)) {
			return true;
		}

		const selection = document.getSelection();
		if (selection?.anchorNode && dom.resultPreview.contains(selection.anchorNode)) {
			return true;
		}

		return false;
	};

	const applySelectedColor = (nextColor: string): void => {
		dom.cvPrimaryColorPicker.value = nextColor;
		applyPreviewPrimaryColor(nextColor);
		onEditorInputChange();
	};

	const applySelectedTemplate = (nextTemplate: string): void => {
		const selectedTemplate = toCvTemplateId(nextTemplate);
		dom.cvTemplateSelect.value = selectedTemplate;
		applyPreviewTemplate(selectedTemplate);
		onEditorInputChange();
	};

	const applyTranslatedHtmlToEditor = (safeTranslatedHtml: string): void => {
		dom.resultPreview.innerHTML = safeTranslatedHtml;
		syncEditorStateAfterProgrammaticChange();
	};

	const loadEntry = async (entryId: string): Promise<void> => {
		if (!entryId) {
			setStatus('error', 'ID invalido', 'La URL no contiene un identificador de version valido.');
			dom.outputMeta.textContent = 'Version no encontrada.';
			setSaveIndicator('error', 'Autoguardado no disponible.');
			return;
		}

		setStatus('proceso', 'Cargando version', 'Recuperando contenido desde historial local.');

		try {
			const entry = await readHistoryEntryById(entryId);
			if (!entry) {
				setStatus(
					'error',
					'No se encontro la version',
					'Esta version no existe en tu historial local o fue eliminada.'
				);
				dom.outputMeta.textContent = 'Version no disponible.';
				setSaveIndicator('error', 'Autoguardado no disponible.');
				return;
			}

			if (typeof entry.optimizedHTML !== 'string' || entry.optimizedHTML.length === 0) {
				setStatus(
					'error',
					'Contenido invalido',
					'La version guardada no contiene HTML optimizado valido.'
				);
				dom.outputMeta.textContent = 'Version invalida.';
				setSaveIndicator('error', 'Autoguardado no disponible.');
				return;
			}

			const normalizedEntry: HistoryEntry = {
				...entry,
				templateId: toCvTemplateId(entry.templateId),
				targetPositions: Array.isArray(entry.targetPositions) ? entry.targetPositions : []
			};

			currentEntry = normalizedEntry;
			currentDocumentBaseName = (
				normalizedEntry.sourceFileName ||
				normalizedEntry.safeFileName ||
				'cv-optimizado'
			).replace(/\.[^.]+$/, '');

			const selectedColor =
				typeof normalizedEntry.primaryColor === 'string' &&
				normalizedEntry.primaryColor.length > 0
					? normalizedEntry.primaryColor
					: DEFAULT_PRIMARY_COLOR;
			const selectedTemplate = toCvTemplateId(normalizedEntry.templateId);

			dom.cvPrimaryColorPicker.value = selectedColor;
			dom.cvTemplateSelect.value = selectedTemplate;
			applyPreviewTemplate(selectedTemplate);
			showResult(normalizedEntry.optimizedHTML);
			applyPreviewPrimaryColor(selectedColor);

			undoRedo.clear();
			captureSnapshotNow();
			updateUndoRedoButtons();

			const sourceName =
				normalizedEntry.sourceFileName ||
				normalizedEntry.safeFileName ||
				'CV sin nombre';
			const positionsLabel =
				normalizedEntry.targetPositions.length > 0
					? ` | Posiciones objetivo: ${normalizedEntry.targetPositions.join(', ')}`
					: '';
			dom.outputMeta.textContent = `Version: ${sourceName}${positionsLabel}`;
			setStatus(
				'exito',
				'Version lista',
				'Puedes editar el CV y exportarlo en el formato que prefieras.'
			);
			setSaveIndicator('saved', 'Autoguardado');
		} catch (error) {
			console.error('No se pudo cargar la version dedicada.', error);
			setStatus('error', 'Error al cargar', 'No se pudo recuperar esta version local.');
			dom.outputMeta.textContent = 'Error de carga.';
			setSaveIndicator('error', 'Autoguardado no disponible.');
		}
	};

	return {
		setStatus,
		getSelectedTemplateId,
		getCurrentDocumentBaseName: () => currentDocumentBaseName,
		getEditorSnapshot,
		onEditorInputChange,
		applySelectedColor,
		applySelectedTemplate,
		applyTranslatedHtmlToEditor,
		performUndo,
		performRedo,
		flushAutosave,
		isEditorShortcutContext,
		loadEntry
	};
};
