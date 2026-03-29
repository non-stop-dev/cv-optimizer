import { createPreviewColorApplicator } from '../export-cv/cv-preview-color';
import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';
import { UploadFlowError } from './document-uploader-shared';

const PREVIEW_SELECTOR = '[data-upload-result-preview]';
const DEFAULT_PRIMARY_COLOR = '#0f766e';

interface CreateDocumentUploadResultPreviewOptions {
	resultContainer: HTMLElement;
	resultPreview: HTMLElement;
	resultRaw: HTMLElement;
	cvPrimaryColorPicker: HTMLInputElement;
}

interface DocumentUploadResultPreview {
	clearResult: () => void;
	syncRawHtmlPanel: () => void;
	showResult: (optimizedHTML: string) => void;
	applyPreviewPrimaryColor: (color: string) => void;
}

/**
 * Encapsulates the editable preview shown after upload optimization succeeds.
 */
export const createDocumentUploadResultPreview = (
	options: CreateDocumentUploadResultPreviewOptions
): DocumentUploadResultPreview => {
	const { resultContainer, resultPreview, resultRaw, cvPrimaryColorPicker } = options;
	const applyPreviewPrimaryColor = createPreviewColorApplicator(
		PREVIEW_SELECTOR,
		DEFAULT_PRIMARY_COLOR
	);

	const syncRawHtmlPanel = (): void => {
		resultRaw.textContent = resultPreview.innerHTML;
	};

	const clearResult = (): void => {
		resultContainer.hidden = true;
		resultPreview.innerHTML = '';
		resultRaw.textContent = '';
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

	return {
		clearResult,
		syncRawHtmlPanel,
		showResult,
		applyPreviewPrimaryColor
	};
};
