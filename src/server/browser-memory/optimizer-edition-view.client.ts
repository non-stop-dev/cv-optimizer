import {
	buildHtmlExportDocument,
	buildPrintableHtml,
	downloadTextFile,
	openPrintPreview,
	toCvTemplateId,
	toSafeFileName,
	type CvTemplateId
} from '../export-cv/cv-export';
import { createPreviewColorApplicator, isValidHexColor } from '../export-cv/cv-preview-color';
import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import {
	applyInlineTextFormat,
	applyLinkOnSelection,
	captureSelectionRange,
	hasTextSelectionInsideEditor,
	restoreSelectionRange,
	type InlineTextFormat
} from '../text-editor/active-selection-formatting.client';
import { createUndoRedoController, type EditorSnapshot } from './editor-undo-redo';
import type { HistoryEntry } from './history-entry';
import { readHistoryEntryById, upsertHistoryEntry } from './history-db';

const PREVIEW_SELECTOR = '[data-output-preview]';
const DEFAULT_PRIMARY_COLOR = '#0f766e';
const AUTOSAVE_DEBOUNCE_MS = 500;
const SNAPSHOT_DEBOUNCE_MS = 220;
const UNDO_REDO_RETENTION_MS = 20 * 60 * 1000;
const MAX_UNDO_REDO_SNAPSHOTS = 1200;
const TRANSLATION_TARGET_LANGUAGE = 'en';
const DEFAULT_BROWSER_TRANSLATION_SOURCE_LANGUAGE = 'es';
const MAX_LANGUAGE_DETECTION_TEXT_LENGTH = 4000;
const MIN_LANGUAGE_DETECTION_CONFIDENCE = 0.55;

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
const cvTemplateSelect = document.querySelector('[data-cv-template-select]');
const exportMenuShell = document.querySelector('[data-cv-export-shell]');
const exportMenuTrigger = document.querySelector('[data-cv-export-trigger]');
const exportMenuList = document.querySelector('[data-cv-export-list]');
const exportOptionNodes = Array.from(document.querySelectorAll('[data-cv-export-option]'));
const exportOptionButtons = exportOptionNodes.filter(
	(option): option is HTMLButtonElement => option instanceof HTMLButtonElement
);
const undoButton = document.querySelector('[data-cv-undo]');
const redoButton = document.querySelector('[data-cv-redo]');
const translateToEnglishButton = document.querySelector('[data-cv-translate-en]');
const translateToEnglishButtonLabel = document.querySelector('[data-cv-translate-en-label]');
const translateSourceTooltip = document.querySelector('[data-cv-translate-source-tooltip]');
const formatBoldButton = document.querySelector('[data-cv-format-bold]');
const formatItalicButton = document.querySelector('[data-cv-format-italic]');
const formatUnderlineButton = document.querySelector('[data-cv-format-underline]');
const formatLinkButton = document.querySelector('[data-cv-format-link]');

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
	!(cvTemplateSelect instanceof HTMLSelectElement) ||
	!(exportMenuShell instanceof HTMLElement) ||
	!(exportMenuTrigger instanceof HTMLButtonElement) ||
	!(exportMenuList instanceof HTMLElement) ||
	exportOptionButtons.length === 0 ||
	exportOptionButtons.length !== exportOptionNodes.length ||
	!(undoButton instanceof HTMLButtonElement) ||
	!(redoButton instanceof HTMLButtonElement) ||
	!(translateToEnglishButton instanceof HTMLButtonElement) ||
	!(translateToEnglishButtonLabel instanceof HTMLElement) ||
	!(translateSourceTooltip instanceof HTMLElement) ||
	!(formatBoldButton instanceof HTMLButtonElement) ||
	!(formatItalicButton instanceof HTMLButtonElement) ||
	!(formatUnderlineButton instanceof HTMLButtonElement) ||
	!(formatLinkButton instanceof HTMLButtonElement)
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
let translatingToEnglish = false;
const codingEnvironment =
	root.dataset.codingEnvironment?.trim().toLowerCase() ||
	(import.meta.env.PROD ? 'production' : 'development');

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

const syncRawHtmlPanel = (): void => {
	resultRaw.textContent = resultPreview.innerHTML;
};

const getSelectedTemplateId = (): CvTemplateId => {
	const normalizedTemplate = toCvTemplateId(cvTemplateSelect.value);
	if (cvTemplateSelect.value !== normalizedTemplate) {
		cvTemplateSelect.value = normalizedTemplate;
	}

	return normalizedTemplate;
};

const applyPreviewTemplate = (templateId: CvTemplateId): void => {
	resultPreview.dataset.cvTemplate = templateId;
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

const showResult = (optimizedHTML: string): void => {
	const safeOptimizedHtml = sanitizeCvHtml(optimizedHTML);
	if (!safeOptimizedHtml.trim()) {
		throw new Error('El contenido optimizado no paso la sanitizacion del navegador.');
	}

	resultContainer.hidden = false;
	resultPreview.innerHTML = safeOptimizedHtml;
	applyPreviewTemplate(getSelectedTemplateId());
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
	cvTemplateSelect.value = snapshot.templateId;
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

interface TranslationSuccessPayload {
	ok: true;
	data: {
		translatedHTML: string;
	};
}

interface TranslationErrorPayload {
	ok: false;
	error?: {
		message?: string;
	};
}

type TranslationSource = 'browser-api' | 'llm-remote';

type TranslationPayload = TranslationSuccessPayload | TranslationErrorPayload;

interface BrowserTranslatorInstance {
	translate: (input: string) => Promise<string>;
	ready?: Promise<void>;
	destroy?: () => void;
}

interface BrowserTranslatorApi {
	availability: (options: {
		sourceLanguage: string;
		targetLanguage: string;
	}) => Promise<string>;
	create: (options: {
		sourceLanguage: string;
		targetLanguage: string;
		monitor?: (monitor: EventTarget) => void;
	}) => Promise<BrowserTranslatorInstance>;
}

interface BrowserLanguageDetectionResult {
	detectedLanguage: string;
	confidence: number;
}

interface BrowserLanguageDetectorInstance {
	detect: (input: string) => Promise<BrowserLanguageDetectionResult[]>;
	ready?: Promise<void>;
	destroy?: () => void;
}

interface BrowserLanguageDetectorApi {
	availability: () => Promise<string>;
	create: (options?: {
		monitor?: (monitor: EventTarget) => void;
	}) => Promise<BrowserLanguageDetectorInstance>;
}

const isAvailabilityUsable = (availability: string): boolean => {
	const normalized = availability.trim().toLowerCase();
	return normalized === 'available' || normalized === 'downloadable' || normalized === 'downloading';
};

const normalizeLanguageTag = (languageTag: string): string => {
	return languageTag.trim().toLowerCase().split('-')[0] ?? '';
};

const getBrowserTranslatorApi = (): BrowserTranslatorApi | null => {
	const globalCandidate = globalThis as {
		Translator?: Partial<BrowserTranslatorApi>;
	};

	const translatorApi = globalCandidate.Translator;
	if (!translatorApi) {
		return null;
	}

	if (typeof translatorApi.availability !== 'function' || typeof translatorApi.create !== 'function') {
		return null;
	}

	return translatorApi as BrowserTranslatorApi;
};

const getBrowserLanguageDetectorApi = (): BrowserLanguageDetectorApi | null => {
	const globalCandidate = globalThis as {
		LanguageDetector?: Partial<BrowserLanguageDetectorApi>;
	};

	const detectorApi = globalCandidate.LanguageDetector;
	if (!detectorApi) {
		return null;
	}

	if (typeof detectorApi.availability !== 'function' || typeof detectorApi.create !== 'function') {
		return null;
	}

	return detectorApi as BrowserLanguageDetectorApi;
};

const refreshTranslationSourceTooltipFromAvailability = async (): Promise<void> => {
	const translatorApi = getBrowserTranslatorApi();
	if (!translatorApi) {
		setTranslationSourceTooltip(
			'Fuente disponible: modelo LLM remoto. Tu navegador no soporta la API de traducción local.'
		);
		return;
	}

	try {
		const availability = await translatorApi.availability({
			sourceLanguage: DEFAULT_BROWSER_TRANSLATION_SOURCE_LANGUAGE,
			targetLanguage: TRANSLATION_TARGET_LANGUAGE
		});

		if (isAvailabilityUsable(availability)) {
			setTranslationSourceTooltip(
				'Fuente preferida: API de traducción del navegador. Si falla, se usa modelo LLM remoto.'
			);
			return;
		}
	} catch (error) {
		console.warn('No se pudo verificar la disponibilidad de traduccion local.', error);
	}

	setTranslationSourceTooltip(
		'Fuente disponible: modelo LLM remoto. La API de traducción local no está disponible ahora.'
	);
};

const collectTranslatableTextNodes = (root: Node): Text[] => {
	const ownerDocument = root.ownerDocument ?? document;
	const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];

	let currentNode: Node | null = walker.nextNode();
	while (currentNode) {
		if (currentNode instanceof Text) {
			const parentElement = currentNode.parentElement;
			const rawText = currentNode.textContent ?? '';
			if (rawText.trim().length > 0 && !(parentElement && parentElement.closest('.cv-placeholder'))) {
				textNodes.push(currentNode);
			}
		}

		currentNode = walker.nextNode();
	}

	return textNodes;
};

const preserveOuterWhitespace = (originalText: string, translatedText: string): string => {
	const leadingWhitespace = originalText.match(/^\s*/)?.[0] ?? '';
	const trailingWhitespace = originalText.match(/\s*$/)?.[0] ?? '';
	return `${leadingWhitespace}${translatedText.trim()}${trailingWhitespace}`;
};

const detectSourceLanguage = async (plainText: string): Promise<string | null> => {
	if (plainText.trim().length === 0) {
		return null;
	}

	const detectorApi = getBrowserLanguageDetectorApi();
	if (!detectorApi) {
		return null;
	}

	try {
		const availability = await detectorApi.availability();
		if (!isAvailabilityUsable(availability)) {
			return null;
		}

		const detector = await detectorApi.create();
		try {
			if (detector.ready instanceof Promise) {
				await detector.ready;
			}

			const detectionInput = plainText.slice(0, MAX_LANGUAGE_DETECTION_TEXT_LENGTH);
			const results = await detector.detect(detectionInput);
			if (!Array.isArray(results) || results.length === 0) {
				return null;
			}

			const topResult = results[0];
			if (!topResult || typeof topResult.detectedLanguage !== 'string') {
				return null;
			}

			if (
				typeof topResult.confidence === 'number' &&
				topResult.confidence < MIN_LANGUAGE_DETECTION_CONFIDENCE
			) {
				return null;
			}

			return normalizeLanguageTag(topResult.detectedLanguage);
		} finally {
			if (typeof detector.destroy === 'function') {
				detector.destroy();
			}
		}
	} catch (error) {
		console.warn('LanguageDetector API unavailable or failed. Falling back to backend translation.', error);
		return null;
	}
};

const translateHtmlWithBrowserApi = async (safeHtml: string): Promise<string | null> => {
	const translatorApi = getBrowserTranslatorApi();
	if (!translatorApi) {
		return null;
	}

	const parsedDocument = new DOMParser().parseFromString(`<article>${safeHtml}</article>`, 'text/html');
	const container = parsedDocument.body.firstElementChild;
	if (!(container instanceof HTMLElement)) {
		return null;
	}

	const textNodes = collectTranslatableTextNodes(container);
	if (textNodes.length === 0) {
		return safeHtml;
	}

	const plainText = container.textContent?.trim() ?? '';
	const detectedLanguage = await detectSourceLanguage(plainText);
	const sourceLanguage = detectedLanguage || DEFAULT_BROWSER_TRANSLATION_SOURCE_LANGUAGE;

	if (normalizeLanguageTag(sourceLanguage) === TRANSLATION_TARGET_LANGUAGE) {
		return safeHtml;
	}

	try {
		const availability = await translatorApi.availability({
			sourceLanguage,
			targetLanguage: TRANSLATION_TARGET_LANGUAGE
		});
		if (!isAvailabilityUsable(availability)) {
			return null;
		}

		let translator: BrowserTranslatorInstance | null = null;
		try {
			translator = await translatorApi.create({
				sourceLanguage,
				targetLanguage: TRANSLATION_TARGET_LANGUAGE,
				monitor: (monitor) => {
					monitor.addEventListener('downloadprogress', (event: Event) => {
						const maybeLoaded = (event as { loaded?: unknown }).loaded;
						if (typeof maybeLoaded !== 'number') {
							return;
						}

						const progressPercentage = Math.round(Math.max(0, Math.min(1, maybeLoaded)) * 100);
						setStatus(
							'proceso',
							'Descargando modelo local',
							`Descargando recursos de traduccion local (${progressPercentage}%).`
						);
					});
				}
			});

			if (translator.ready instanceof Promise) {
				await translator.ready;
			}

			for (const textNode of textNodes) {
				const originalText = textNode.textContent ?? '';
				const textToTranslate = originalText.trim();
				if (!textToTranslate) {
					continue;
				}

				const translatedText = await translator.translate(textToTranslate);
				textNode.textContent = preserveOuterWhitespace(originalText, translatedText);
			}

			return container.innerHTML;
		} finally {
			if (translator && typeof translator.destroy === 'function') {
				translator.destroy();
			}
		}
	} catch (error) {
		console.warn('Translator API unavailable or failed. Falling back to backend translation.', error);
		return null;
	}
};

const translateCvToEnglishWithBackend = async (safeHtml: string): Promise<string> => {
	const response = await fetch('/api/translate', {
		method: 'POST',
		headers: {
			'content-type': 'application/json; charset=utf-8'
		},
		body: JSON.stringify({
			optimizedHTML: safeHtml
		})
	});

	const payload = (await response.json().catch(() => null)) as TranslationPayload | null;
	if (!response.ok || !isTranslationSuccessPayload(payload)) {
		throw new Error(extractTranslationErrorMessage(payload));
	}

	const safeTranslatedHtml = sanitizeCvHtml(payload.data.translatedHTML);
	if (!safeTranslatedHtml.trim()) {
		throw new Error('La traduccion no devolvio HTML util.');
	}

	return safeTranslatedHtml;
};

const isTranslationSuccessPayload = (
	payload: TranslationPayload | null
): payload is TranslationSuccessPayload => {
	return payload?.ok === true && typeof payload.data?.translatedHTML === 'string';
};

const extractTranslationErrorMessage = (payload: TranslationPayload | null): string => {
	if (payload && 'error' in payload && typeof payload.error?.message === 'string') {
		return payload.error.message;
	}

	return 'No se pudo traducir el CV al ingles en este momento.';
};

const setTranslationSourceTooltip = (message: string): void => {
	translateSourceTooltip.textContent = message;
	translateToEnglishButton.title = message;
};

const logTranslationSource = (source: TranslationSource, details: string): void => {
	const sourceDescription =
		source === 'browser-api' ? 'api de traduccion del navegador' : 'modelo LLM remoto';
	console.info(
		`[cv-optimizer][${codingEnvironment}] Fuente de traduccion usada: ${sourceDescription}. ${details}`
	);
};

const setTranslateButtonLoadingState = (isLoading: boolean): void => {
	translateToEnglishButton.disabled = isLoading;
	translateToEnglishButtonLabel.textContent = isLoading ? 'Traduciendo...' : 'Traducir al inglés';
};

const syncEditorStateAfterProgrammaticChange = (): void => {
	syncRawHtmlPanel();
	captureSnapshotNow();
	updateUndoRedoButtons();
	scheduleAutosave();
};

const applyInlineFormatWithFeedback = (format: InlineTextFormat): void => {
	if (!hasTextSelectionInsideEditor(resultPreview)) {
		setStatus('error', 'Seleccion no valida', 'Selecciona texto dentro del CV para aplicar formato.');
		return;
	}

	const formatted = applyInlineTextFormat(resultPreview, format);
	if (!formatted) {
		setStatus('error', 'No se pudo aplicar formato', 'No se pudo actualizar el texto seleccionado.');
		return;
	}

	onEditorInputChange();
	resultPreview.focus();
};

const applyLinkWithFeedback = (): void => {
	if (!hasTextSelectionInsideEditor(resultPreview)) {
		setStatus('error', 'Seleccion no valida', 'Selecciona texto dentro del CV para insertar un enlace.');
		return;
	}

	const selectionRange = captureSelectionRange(resultPreview);
	const providedLink = window.prompt('Ingresa el enlace (https://, correo o telefono):', 'https://');
	if (providedLink === null) {
		return;
	}

	restoreSelectionRange(selectionRange);
	const linked = applyLinkOnSelection(resultPreview, providedLink);
	if (!linked) {
		setStatus(
			'error',
			'Enlace invalido',
			'No se pudo insertar el enlace. Usa una URL segura (https://), correo o telefono valido.'
		);
		return;
	}

	onEditorInputChange();
	resultPreview.focus();
};

const translateCurrentCvToEnglish = async (): Promise<void> => {
	if (translatingToEnglish) {
		return;
	}

	const snapshot = getEditorSnapshot();
	if (!snapshot) {
		setStatus('error', 'No hay contenido para traducir', 'Edita o carga un CV antes de traducir.');
		return;
	}

	translatingToEnglish = true;
	setTranslateButtonLoadingState(true);
	setStatus('proceso', 'Traduciendo CV', 'Intentando traduccion local en el navegador...');

	try {
		const localTranslatedHtml = await translateHtmlWithBrowserApi(snapshot.optimizedHTML);
		if (typeof localTranslatedHtml === 'string' && localTranslatedHtml.trim().length > 0) {
			const safeLocalTranslatedHtml = sanitizeCvHtml(localTranslatedHtml);
			if (safeLocalTranslatedHtml.trim()) {
				resultPreview.innerHTML = safeLocalTranslatedHtml;
				syncEditorStateAfterProgrammaticChange();
				setTranslationSourceTooltip('Última traducción: API de traducción del navegador.');
				logTranslationSource(
					'browser-api',
					'Se tocó el botón de traducción y se completó con la API local del navegador.'
				);
				setStatus(
					'exito',
					'CV traducido',
					'Se actualizo el editor con la version en ingles usando traduccion local del navegador.'
				);
				return;
			}

			console.warn('La traduccion local devolvio HTML vacio o invalido. Se usara fallback remoto.');
		}

		setStatus('proceso', 'Traduciendo CV', 'Traduccion local no disponible. Usando servicio remoto...');
		setTranslationSourceTooltip('Última traducción: modelo LLM remoto.');
		logTranslationSource(
			'llm-remote',
			'Se tocó el botón de traducción y se utilizó el servicio remoto de traducción.'
		);
		const backendTranslatedHtml = await translateCvToEnglishWithBackend(snapshot.optimizedHTML);
		resultPreview.innerHTML = backendTranslatedHtml;
		syncEditorStateAfterProgrammaticChange();
		setStatus('exito', 'CV traducido', 'Se actualizo el editor con la version en ingles usando modelo remoto.');
	} catch (error) {
		console.error('No se pudo traducir el CV al ingles.', error);
		setStatus(
			'error',
			'No se pudo traducir',
			error instanceof Error ? error.message : 'Fallo inesperado al traducir el CV.'
		);
	} finally {
		translatingToEnglish = false;
		setTranslateButtonLoadingState(false);
	}
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

		const normalizedEntry: HistoryEntry = {
			...entry,
			templateId: toCvTemplateId(entry.templateId),
			targetPositions: Array.isArray(entry.targetPositions) ? entry.targetPositions : []
		};

		currentEntry = normalizedEntry;
		currentDocumentBaseName =
			(normalizedEntry.sourceFileName || normalizedEntry.safeFileName || 'cv-optimizado').replace(
				/\.[^.]+$/,
				''
			);

		const selectedColor =
			typeof normalizedEntry.primaryColor === 'string' && normalizedEntry.primaryColor.length > 0
				? normalizedEntry.primaryColor
				: DEFAULT_PRIMARY_COLOR;
		const selectedTemplate = toCvTemplateId(normalizedEntry.templateId);
		cvPrimaryColorPicker.value = selectedColor;
		cvTemplateSelect.value = selectedTemplate;
		applyPreviewTemplate(selectedTemplate);
		showResult(normalizedEntry.optimizedHTML);
		applyPreviewPrimaryColor(selectedColor);

		undoRedo.clear();
		captureSnapshotNow();
		updateUndoRedoButtons();

		const sourceName =
			normalizedEntry.sourceFileName || normalizedEntry.safeFileName || 'CV sin nombre';
		const positionsLabel =
			normalizedEntry.targetPositions.length > 0
				? ` | Posiciones objetivo: ${normalizedEntry.targetPositions.join(', ')}`
				: '';
		outputMeta.textContent = `Version: ${sourceName}${positionsLabel}`;
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

cvTemplateSelect.addEventListener('change', (event) => {
	const target = event.currentTarget;
	if (!(target instanceof HTMLSelectElement)) {
		return;
	}

	const selectedTemplate = toCvTemplateId(target.value);
	target.value = selectedTemplate;
	applyPreviewTemplate(selectedTemplate);
	onEditorInputChange();
});

undoButton.addEventListener('click', () => {
	performUndo();
});

redoButton.addEventListener('click', () => {
	performRedo();
});

translateToEnglishButton.addEventListener('click', () => {
	void translateCurrentCvToEnglish();
});

const keepSelectionWhileClickingToolbar = (event: MouseEvent): void => {
	event.preventDefault();
};

[formatBoldButton, formatItalicButton, formatUnderlineButton, formatLinkButton].forEach((button) => {
	button.addEventListener('mousedown', keepSelectionWhileClickingToolbar);
});

formatBoldButton.addEventListener('click', () => {
	applyInlineFormatWithFeedback('bold');
});

formatItalicButton.addEventListener('click', () => {
	applyInlineFormatWithFeedback('italic');
});

formatUnderlineButton.addEventListener('click', () => {
	applyInlineFormatWithFeedback('underline');
});

formatLinkButton.addEventListener('click', () => {
	applyLinkWithFeedback();
});

document.addEventListener('keydown', handleGlobalUndoRedoHotkeys);

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') {
		flushAutosave();
	}
});

window.addEventListener('pagehide', flushAutosave);
window.addEventListener('beforeunload', flushAutosave);

const exportCurrentHtml = (): void => {
	if (!resultPreview.innerHTML.trim()) {
		setStatus('error', 'No hay contenido para exportar', 'Edita o carga un CV antes de exportar.');
		return;
	}

	const fileName = toSafeFileName(currentDocumentBaseName, 'html');
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

	const fileName = toSafeFileName(currentDocumentBaseName, 'txt');
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
			setStatus('error', 'Formato no soportado', 'Selecciona un formato de exportación válido.');
	}
};

exportMenuTrigger.addEventListener('click', () => {
	toggleExportMenu();
});

exportOptionButtons.forEach((optionButton) => {
	optionButton.addEventListener('click', () => {
		const selectedFormat = optionButton.dataset.cvExportOption;
		closeExportMenu();
		if (typeof selectedFormat !== 'string') {
			setStatus('error', 'Formato no soportado', 'Selecciona un formato de exportación válido.');
			return;
		}

		exportByFormat(selectedFormat);
	});
});

document.addEventListener('click', (event) => {
	const target = event.target;
	if (!(target instanceof Node)) {
		return;
	}

	if (!exportMenuShell.contains(target)) {
		closeExportMenu();
	}
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape') {
		closeExportMenu();
	}
});

setTranslateButtonLoadingState(false);
void refreshTranslationSourceTooltipFromAvailability();

loadEntry();
