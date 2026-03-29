import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import {
	createOptimizerEditionEditorStateController
} from './optimizer-edition-editor-state.client';
import {
	createOptimizerEditionExportWorkflow
} from './optimizer-edition-export-workflow.client';
import { bindOptimizerEditionFormatToolbar } from './optimizer-edition-format-toolbar.client';
import {
	createOptimizerEditionTranslationWorkflow
} from './optimizer-edition-translation-workflow.client';
import { getOptimizerEditionViewDom } from './optimizer-edition-view-dom.client';

const dom = getOptimizerEditionViewDom();
const entryId = dom.root.dataset.entryId?.trim() ?? '';

const editorState = createOptimizerEditionEditorStateController({ dom });
const exportWorkflow = createOptimizerEditionExportWorkflow({
	resultPreview: dom.resultPreview,
	cvPrimaryColorPicker: dom.cvPrimaryColorPicker,
	getSelectedTemplateId: editorState.getSelectedTemplateId,
	getCurrentDocumentBaseName: editorState.getCurrentDocumentBaseName,
	setStatus: editorState.setStatus,
	exportMenuList: dom.exportMenuList,
	exportMenuTrigger: dom.exportMenuTrigger
});
const translationWorkflow = createOptimizerEditionTranslationWorkflow({
	translateToEnglishButton: dom.translateToEnglishButton,
	translateToEnglishButtonLabel: dom.translateToEnglishButtonLabel,
	translateSourceTooltip: dom.translateSourceTooltip,
	getEditorSnapshot: editorState.getEditorSnapshot,
	applyTranslatedHtmlToEditor: editorState.applyTranslatedHtmlToEditor,
	sanitizeHtml: sanitizeCvHtml,
	setStatus: editorState.setStatus
});

bindOptimizerEditionFormatToolbar({
	dom,
	setStatus: editorState.setStatus,
	onEditorInputChange: editorState.onEditorInputChange
});

const handleGlobalUndoRedoHotkeys = (event: KeyboardEvent): void => {
	if (!editorState.isEditorShortcutContext(event.target)) {
		return;
	}

	const key = event.key.toLowerCase();
	const hasPrimaryModifier = event.metaKey || event.ctrlKey;
	const isUndo = hasPrimaryModifier && !event.shiftKey && key === 'z';
	const isRedo =
		(hasPrimaryModifier && event.shiftKey && key === 'z') ||
		(event.ctrlKey && key === 'y');

	if (isUndo) {
		event.preventDefault();
		editorState.performUndo();
		return;
	}

	if (isRedo) {
		event.preventDefault();
		editorState.performRedo();
	}
};

dom.resultPreview.addEventListener('input', editorState.onEditorInputChange);

dom.cvPrimaryColorPicker.addEventListener('input', (event) => {
	const target = event.currentTarget;
	if (target instanceof HTMLInputElement) {
		editorState.applySelectedColor(target.value);
	}
});

dom.cvTemplateSelect.addEventListener('change', (event) => {
	const target = event.currentTarget;
	if (target instanceof HTMLSelectElement) {
		editorState.applySelectedTemplate(target.value);
	}
});

dom.undoButton.addEventListener('click', editorState.performUndo);
dom.redoButton.addEventListener('click', editorState.performRedo);

dom.translateToEnglishButton.addEventListener('click', () => {
	void translationWorkflow.translateCurrentCvToEnglish();
});

dom.exportMenuTrigger.addEventListener('click', exportWorkflow.toggleExportMenu);

dom.exportOptionButtons.forEach((optionButton) => {
	optionButton.addEventListener('click', () => {
		const selectedFormat = optionButton.dataset.cvExportOption;
		exportWorkflow.closeExportMenu();
		if (typeof selectedFormat !== 'string') {
			editorState.setStatus(
				'error',
				'Formato no soportado',
				'Selecciona un formato de exportacion valido.'
			);
			return;
		}

		exportWorkflow.exportByFormat(selectedFormat);
	});
});

document.addEventListener('click', (event) => {
	const target = event.target;
	if (target instanceof Node && !dom.exportMenuShell.contains(target)) {
		exportWorkflow.closeExportMenu();
	}
});

document.addEventListener('keydown', (event) => {
	handleGlobalUndoRedoHotkeys(event);
	if (event.key === 'Escape') {
		exportWorkflow.closeExportMenu();
	}
});

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') {
		editorState.flushAutosave();
	}
});

window.addEventListener('pagehide', editorState.flushAutosave);
window.addEventListener('beforeunload', editorState.flushAutosave);

void translationWorkflow.initializeTranslationTooltip();
void editorState.loadEntry(entryId);
