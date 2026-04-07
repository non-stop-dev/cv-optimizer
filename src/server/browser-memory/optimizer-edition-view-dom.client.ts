export interface OptimizerEditionViewDom {
	root: HTMLElement;
	statusContainer: HTMLElement;
	statusTitle: HTMLElement;
	statusMessage: HTMLElement;
	outputMeta: HTMLElement;
	outputSaveIndicator: HTMLElement;
	resultContainer: HTMLElement;
	resultPreview: HTMLElement;
	resultRaw: HTMLElement;
	cvPrimaryColorPicker: HTMLInputElement;
	cvTemplateSelect: HTMLSelectElement;
	exportMenuShell: HTMLElement;
	exportMenuTrigger: HTMLButtonElement;
	exportMenuList: HTMLElement;
	exportOptionButtons: HTMLButtonElement[];
	undoButton: HTMLButtonElement;
	redoButton: HTMLButtonElement;
	translateToEnglishButton: HTMLButtonElement;
	translateToEnglishButtonLabel: HTMLElement;
	translateSourceTooltip: HTMLElement;
	formatBoldButton: HTMLButtonElement;
	formatItalicButton: HTMLButtonElement;
	formatUnderlineButton: HTMLButtonElement;
	formatBulletListButton: HTMLButtonElement;
	formatTextSizeSelect: HTMLSelectElement;
	formatTextColorApplyButton: HTMLButtonElement;
	formatTextColorPicker: HTMLInputElement;
	formatTextColorSwatch: HTMLElement;
	formatLinkButton: HTMLButtonElement;
}

export const getOptimizerEditionViewDom = (): OptimizerEditionViewDom => {
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
	const formatBulletListButton = document.querySelector('[data-cv-format-bullet-list]');
	const formatTextSizeSelect = document.querySelector('[data-cv-format-text-size]');
	const formatTextColorApplyButton = document.querySelector('[data-cv-format-text-color-apply]');
	const formatTextColorPicker = document.querySelector('[data-cv-format-text-color-picker]');
	const formatTextColorSwatch = document.querySelector('[data-cv-format-text-color-swatch]');
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
		!(formatBulletListButton instanceof HTMLButtonElement) ||
		!(formatTextSizeSelect instanceof HTMLSelectElement) ||
		!(formatTextColorApplyButton instanceof HTMLButtonElement) ||
		!(formatTextColorPicker instanceof HTMLInputElement) ||
		!(formatTextColorSwatch instanceof HTMLElement) ||
		!(formatLinkButton instanceof HTMLButtonElement)
	) {
		throw new Error('No se pudo inicializar la vista dedicada del CV optimizado.');
	}

	return {
		root,
		statusContainer,
		statusTitle,
		statusMessage,
		outputMeta,
		outputSaveIndicator,
		resultContainer,
		resultPreview,
		resultRaw,
		cvPrimaryColorPicker,
		cvTemplateSelect,
		exportMenuShell,
		exportMenuTrigger,
		exportMenuList,
		exportOptionButtons,
		undoButton,
		redoButton,
		translateToEnglishButton,
		translateToEnglishButtonLabel,
		translateSourceTooltip,
		formatBoldButton,
		formatItalicButton,
		formatUnderlineButton,
		formatBulletListButton,
		formatTextSizeSelect,
		formatTextColorApplyButton,
		formatTextColorPicker,
		formatTextColorSwatch,
		formatLinkButton
	};
};
