import {
	buildHtmlExportDocument,
	buildPrintableHtml,
	downloadTextFile,
	openPrintPreview,
	toSafeFileName
} from '../export-cv/cv-export';
import { createPreviewColorApplicator, isValidHexColor } from '../export-cv/cv-preview-color';
import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import { createUndoRedoController, type EditorSnapshot } from './editor-undo-redo';
import type { HistoryEntry } from './history-entry';
import { readHistoryEntryById, upsertHistoryEntry } from './history-db';

const PREVIEW_SELECTOR = '[data-output-preview]';
const DEFAULT_PRIMARY_COLOR = '#0f766e';
const AUTOSAVE_DEBOUNCE_MS = 500;
const SNAPSHOT_DEBOUNCE_MS = 220;
const UNDO_REDO_RETENTION_MS = 20 * 60 * 1000;
const MAX_UNDO_REDO_SNAPSHOTS = 1200;

type StatusTone = 'proceso' | 'exito' | 'error';
type SaveIndicatorState = 'idle' | 'saving' | 'saved' | 'error';

const root = document.querySelector('[data-output-root]');
const statusContainer = document.querySelector('[data-output-status]');
const statusTitle = document.querySelector('[data-output-status-title]');
const statusMessage = document.querySelector('[data-output-status-message]');
const outputMeta = document.querySelector('[data-output-meta]');
const outputSaveIndicator = document.querySelector('[data-output-save-indicator]');
const resultContainer = document.querySelector('[data-output-result]');
const resultPreview = document.querySelector('[data-output-preview]');
const resultRaw = document.querySelector('[data-output-raw]');
const cvPrimaryColorPicker = document.querySelector('[data-cv-primary-color]');
const exportHtmlButton = document.querySelector('[data-cv-export-html]');
const exportTxtButton = document.querySelector('[data-cv-export-txt]');
const exportPdfButton = document.querySelector('[data-cv-export-pdf]');
const undoButton = document.querySelector('[data-cv-undo]');
const redoButton = document.querySelector('[data-cv-redo]');

if (
	!(root instanceof HTMLElement) ||
	!(statusContainer instanceof HTMLElement) ||
	!(statusTitle instanceof HTMLElement) ||
	!(statusMessage instanceof HTMLElement) ||
	!(outputMeta instanceof HTMLElement) ||
	!(outputSaveIndicator instanceof HTMLElement) ||
	!(resultContainer instanceof HTMLElement) ||
	!(resultPreview instanceof HTMLElement) ||
	!(resultRaw instanceof HTMLElement) ||
	!(cvPrimaryColorPicker instanceof HTMLInputElement) ||
	!(exportHtmlButton instanceof HTMLButtonElement) ||
	!(exportTxtButton instanceof HTMLButtonElement) ||
	!(exportPdfButton instanceof HTMLButtonElement) ||
	!(undoButton instanceof HTMLButtonElement) ||
	!(redoButton instanceof HTMLButtonElement)
) {
	throw new Error('No se pudo inicializar la vista dedicada del CV optimizado.');
}

const entryId = root.dataset.entryId;
const applyPreviewPrimaryColor = createPreviewColorApplicator(PREVIEW_SELECTOR, DEFAULT_PRIMARY_COLOR);
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
	outputSaveIndicator.dataset.state = state;
	outputSaveIndicator.textContent = message;
};

const setStatus = (tone: StatusTone, title: string, message: string): void => {
	statusContainer.hidden = false;
	statusContainer.dataset.tone = tone;
	statusTitle.textContent = title;
	statusMessage.textContent = message;
};

const syncRawHtmlPanel = (): void => {
	resultRaw.textContent = resultPreview.innerHTML;
};

const updateUndoRedoButtons = (): void => {
	undoButton.disabled = !undoRedo.canUndo();
	redoButton.disabled = !undoRedo.canRedo();
};

const getEditorSnapshot = (): EditorSnapshot | null => {
	const safeOptimizedHtml = sanitizeCvHtml(resultPreview.innerHTML);
	if (!safeOptimizedHtml.trim()) {
		return null;
	}

	const nextColor = isValidHexColor(cvPrimaryColorPicker.value)
		? cvPrimaryColorPicker.value
		: DEFAULT_PRIMARY_COLOR;

	return {
		optimizedHTML: safeOptimizedHtml,
		primaryColor: nextColor,
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

const showResult = (optimizedHTML: string): void => {
	const safeOptimizedHtml = sanitizeCvHtml(optimizedHTML);
	if (!safeOptimizedHtml.trim()) {
		throw new Error('El contenido optimizado no paso la sanitizacion del navegador.');
	}

	resultContainer.hidden = false;
	resultPreview.innerHTML = safeOptimizedHtml;
	applyPreviewPrimaryColor(cvPrimaryColorPicker.value);
	syncRawHtmlPanel();
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
		primaryColor: snapshot.primaryColor
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

const flushAutosave = (): void => {
	flushSnapshotCapture();
	if (autosaveTimer === null) {
		return;
	}

	window.clearTimeout(autosaveTimer);
	autosaveTimer = null;
	void persistCurrentEntry();
};

const applyEditorSnapshot = (snapshot: EditorSnapshot): void => {
	applyingSnapshot = true;
	cvPrimaryColorPicker.value = snapshot.primaryColor;
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

const isEditorShortcutContext = (target: EventTarget | null): boolean => {
	if (target instanceof Node && resultContainer.contains(target)) {
		return true;
	}

	const active = document.activeElement;
	if (active instanceof Node && resultContainer.contains(active)) {
		return true;
	}

	const selection = document.getSelection();
	if (selection?.anchorNode && resultPreview.contains(selection.anchorNode)) {
		return true;
	}

	return false;
};

const onEditorInputChange = (): void => {
	if (applyingSnapshot) {
		return;
	}

	syncRawHtmlPanel();
	scheduleSnapshotCapture();
	scheduleAutosave();
};

const handleGlobalUndoRedoHotkeys = (event: KeyboardEvent): void => {
	if (!isEditorShortcutContext(event.target)) {
		return;
	}

	const key = event.key.toLowerCase();
	const hasPrimaryModifier = event.metaKey || event.ctrlKey;
	const isUndo = hasPrimaryModifier && !event.shiftKey && key === 'z';
	const isRedo = (hasPrimaryModifier && event.shiftKey && key === 'z') || (event.ctrlKey && key === 'y');

	if (isUndo) {
		event.preventDefault();
		performUndo();
		return;
	}

	if (isRedo) {
		event.preventDefault();
		performRedo();
	}
};

const loadEntry = async (): Promise<void> => {
	if (typeof entryId !== 'string' || entryId.length === 0) {
		setStatus('error', 'ID invalido', 'La URL no contiene un identificador de version valido.');
		outputMeta.textContent = 'Version no encontrada.';
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
			outputMeta.textContent = 'Version no disponible.';
			setSaveIndicator('error', 'Autoguardado no disponible.');
			return;
		}

		if (typeof entry.optimizedHTML !== 'string' || entry.optimizedHTML.length === 0) {
			setStatus(
				'error',
				'Contenido invalido',
				'La version guardada no contiene HTML optimizado valido.'
			);
			outputMeta.textContent = 'Version invalida.';
			setSaveIndicator('error', 'Autoguardado no disponible.');
			return;
		}

		currentEntry = entry;
		currentDocumentBaseName =
			(entry.sourceFileName || entry.safeFileName || 'cv-optimizado').replace(/\.[^.]+$/, '');

		const selectedColor =
			typeof entry.primaryColor === 'string' && entry.primaryColor.length > 0
				? entry.primaryColor
				: DEFAULT_PRIMARY_COLOR;
		cvPrimaryColorPicker.value = selectedColor;
		showResult(entry.optimizedHTML);
		applyPreviewPrimaryColor(selectedColor);

		undoRedo.clear();
		captureSnapshotNow();
		updateUndoRedoButtons();

		const sourceName = entry.sourceFileName || entry.safeFileName || 'CV sin nombre';
		outputMeta.textContent = `Version: ${sourceName}`;
		setStatus('exito', 'Version lista', 'Puedes editar el CV y exportarlo en el formato que prefieras.');
		setSaveIndicator('saved', 'Autoguardado');
	} catch (error) {
		console.error('No se pudo cargar la version dedicada.', error);
		setStatus('error', 'Error al cargar', 'No se pudo recuperar esta version local.');
		outputMeta.textContent = 'Error de carga.';
		setSaveIndicator('error', 'Autoguardado no disponible.');
	}
};

resultPreview.addEventListener('input', onEditorInputChange);

cvPrimaryColorPicker.addEventListener('input', (event) => {
	const target = event.currentTarget;
	if (!(target instanceof HTMLInputElement)) {
		return;
	}

	applyPreviewPrimaryColor(target.value);
	onEditorInputChange();
});

undoButton.addEventListener('click', () => {
	performUndo();
});

redoButton.addEventListener('click', () => {
	performRedo();
});

document.addEventListener('keydown', handleGlobalUndoRedoHotkeys);

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') {
		flushAutosave();
	}
});

window.addEventListener('pagehide', flushAutosave);
window.addEventListener('beforeunload', flushAutosave);

exportHtmlButton.addEventListener('click', () => {
	if (!resultPreview.innerHTML.trim()) {
		setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
		return;
	}

	const fileName = toSafeFileName(currentDocumentBaseName, 'html');
	const htmlDocument = buildHtmlExportDocument(resultPreview.innerHTML, cvPrimaryColorPicker.value);
	downloadTextFile(fileName, htmlDocument, 'text/html;charset=utf-8');
});

exportTxtButton.addEventListener('click', () => {
	const plainText = resultPreview.innerText.trim();
	if (!plainText) {
		setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
		return;
	}

	const fileName = toSafeFileName(currentDocumentBaseName, 'txt');
	downloadTextFile(fileName, plainText, 'text/plain;charset=utf-8');
});

exportPdfButton.addEventListener('click', () => {
	if (!resultPreview.innerHTML.trim()) {
		setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
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
});

loadEntry();
