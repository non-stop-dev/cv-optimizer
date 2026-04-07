import {
	applyInlineTextFormat,
	applyLinkOnSelection,
	applyTextColorFormat,
	applyTextSizeFormat,
	toggleBulletListOnSelection,
	type InlineTextFormat
} from '../text-editor/active-selection-formatting.client';
import {
	captureSelectionRange,
	hasCursorInsideEditor,
	hasTextSelectionInsideEditor,
	restoreSelectionRange
} from '../text-editor/active-selection-range.client';
import type { OptimizerEditionStatusTone } from './optimizer-edition-editor-state.client';
import type { OptimizerEditionViewDom } from './optimizer-edition-view-dom.client';

interface BindOptimizerEditionFormatToolbarOptions {
	dom: Pick<
		OptimizerEditionViewDom,
		| 'resultPreview'
		| 'formatBoldButton'
		| 'formatItalicButton'
		| 'formatUnderlineButton'
		| 'formatBulletListButton'
		| 'formatTextSizeSelect'
		| 'formatTextColorApplyButton'
		| 'formatTextColorPicker'
		| 'formatTextColorSwatch'
		| 'formatLinkButton'
	>;
	setStatus: (tone: OptimizerEditionStatusTone, title: string, message: string) => void;
	onEditorInputChange: () => void;
}

/**
 * Binds formatting actions without forcing the main editor entrypoint to know
 * about selection restoration details.
 */
export const bindOptimizerEditionFormatToolbar = (
	options: BindOptimizerEditionFormatToolbarOptions
): void => {
	const { dom, setStatus, onEditorInputChange } = options;
	let preservedSelectionRange: Range | null = null;
	let lastManualTextColor = dom.formatTextColorPicker.value.toLowerCase();

	const normalizeHexColor = (value: string | null | undefined): string | null => {
		if (!value) {
			return null;
		}

		const trimmedValue = value.trim().toLowerCase();
		if (/^#[0-9a-f]{6}$/.test(trimmedValue)) {
			return trimmedValue;
		}

		if (/^#[0-9a-f]{3}$/.test(trimmedValue)) {
			return `#${trimmedValue[1]}${trimmedValue[1]}${trimmedValue[2]}${trimmedValue[2]}${trimmedValue[3]}${trimmedValue[3]}`;
		}

		const rgbMatch = trimmedValue.match(
			/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/
		);
		if (!rgbMatch) {
			return null;
		}

		const [red, green, blue] = rgbMatch.slice(1, 4).map((component) =>
			Math.max(0, Math.min(255, Number.parseInt(component, 10)))
		);

		return `#${[red, green, blue]
			.map((component) => component.toString(16).padStart(2, '0'))
			.join('')}`;
	};

	const syncTextColorSwatch = (): void => {
		dom.formatTextColorSwatch.style.backgroundColor = dom.formatTextColorPicker.value;
	};

	const setPickerColor = (color: string, source: 'manual' | 'selection'): void => {
		const normalizedColor = normalizeHexColor(color);
		if (!normalizedColor) {
			return;
		}

		dom.formatTextColorPicker.value = normalizedColor;
		syncTextColorSwatch();
		if (source === 'manual') {
			lastManualTextColor = normalizedColor;
		}
	};

	const getSelectedTextColor = (): string | null => {
		if (!hasTextSelectionInsideEditor(dom.resultPreview)) {
			return null;
		}

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return null;
		}

		const activeRange = selection.getRangeAt(0);
		const anchorNode =
			activeRange.startContainer.nodeType === Node.TEXT_NODE
				? activeRange.startContainer.parentElement
				: activeRange.startContainer instanceof HTMLElement
					? activeRange.startContainer
					: activeRange.commonAncestorContainer.parentElement;

		if (!(anchorNode instanceof HTMLElement) || !dom.resultPreview.contains(anchorNode)) {
			return null;
		}

		return normalizeHexColor(window.getComputedStyle(anchorNode).color);
	};

	const syncPickerFromSelection = (): void => {
		const selectedTextColor = getSelectedTextColor();
		if (selectedTextColor) {
			setPickerColor(selectedTextColor, 'selection');
			return;
		}

		setPickerColor(lastManualTextColor, 'manual');
	};

	const captureSelectionForColorControls = (): void => {
		preservedSelectionRange = captureSelectionRange(dom.resultPreview);
	};

	const applyInlineFormatWithFeedback = (format: InlineTextFormat): void => {
		if (!hasTextSelectionInsideEditor(dom.resultPreview)) {
			setStatus(
				'error',
				'Seleccion no valida',
				'Selecciona texto dentro del CV para aplicar formato.'
			);
			return;
		}

		const formatted = applyInlineTextFormat(dom.resultPreview, format);
		if (!formatted) {
			setStatus(
				'error',
				'No se pudo aplicar formato',
				'No se pudo actualizar el texto seleccionado.'
			);
			return;
		}

		onEditorInputChange();
		dom.resultPreview.focus();
	};

	const applyLinkWithFeedback = (): void => {
		if (!hasTextSelectionInsideEditor(dom.resultPreview)) {
			setStatus(
				'error',
				'Seleccion no valida',
				'Selecciona texto dentro del CV para insertar un enlace.'
			);
			return;
		}

		const selectionRange = captureSelectionRange(dom.resultPreview);
		const providedLink = window.prompt(
			'Ingresa el enlace (https://, correo o telefono):',
			'https://'
		);
		if (providedLink === null) {
			return;
		}

		restoreSelectionRange(selectionRange);
		const linked = applyLinkOnSelection(dom.resultPreview, providedLink);
		if (!linked) {
			setStatus(
				'error',
				'Enlace invalido',
				'No se pudo insertar el enlace. Usa una URL segura (https://), correo o telefono valido.'
			);
			return;
		}

		onEditorInputChange();
		dom.resultPreview.focus();
	};

	const applyBulletListWithFeedback = (): void => {
		if (!hasCursorInsideEditor(dom.resultPreview)) {
			setStatus(
				'error',
				'Seleccion no valida',
				'Coloca el cursor o selecciona texto dentro del CV para crear una lista.'
			);
			return;
		}

		const updated = toggleBulletListOnSelection(dom.resultPreview);
		if (!updated) {
			setStatus(
				'error',
				'No se pudo crear la lista',
				'No se pudo transformar el bloque seleccionado en bullet points.'
			);
			return;
		}

		onEditorInputChange();
		dom.resultPreview.focus();
	};

	const applyTextSizeWithFeedback = (): void => {
		const selectedSize = dom.formatTextSizeSelect.value;
		if (!hasTextSelectionInsideEditor(dom.resultPreview)) {
			setStatus(
				'error',
				'Seleccion no valida',
				'Selecciona texto dentro del CV para cambiar el tamano.'
			);
			return;
		}

		const updated = applyTextSizeFormat(
			dom.resultPreview,
			selectedSize as Parameters<typeof applyTextSizeFormat>[1]
		);
		if (!updated) {
			setStatus(
				'error',
				'No se pudo cambiar el tamano',
				'No se pudo aplicar el tamano seleccionado.'
			);
			return;
		}

		onEditorInputChange();
		dom.resultPreview.focus();
	};

	const applyTextColorWithFeedback = (showErrorWhenMissingSelection = true): void => {
		restoreSelectionRange(preservedSelectionRange);
		const selectedColor = dom.formatTextColorPicker.value;
		if (!hasTextSelectionInsideEditor(dom.resultPreview)) {
			if (showErrorWhenMissingSelection) {
				setStatus(
					'error',
					'Seleccion no valida',
					'Selecciona texto dentro del CV para cambiar el color.'
				);
			}
			return;
		}

		const updated = applyTextColorFormat(
			dom.resultPreview,
			selectedColor as Parameters<typeof applyTextColorFormat>[1]
		);
		if (!updated) {
			if (showErrorWhenMissingSelection) {
				setStatus(
					'error',
					'No se pudo cambiar el color',
					'No se pudo aplicar el color seleccionado.'
				);
			}
			return;
		}

		lastManualTextColor = selectedColor.toLowerCase();
		preservedSelectionRange = captureSelectionRange(dom.resultPreview);
		onEditorInputChange();
		dom.resultPreview.focus();
	};

	const keepSelectionWhileClickingToolbar = (event: MouseEvent): void => {
		event.preventDefault();
	};

	[
		dom.formatBoldButton,
		dom.formatItalicButton,
		dom.formatUnderlineButton,
		dom.formatBulletListButton,
		dom.formatTextColorApplyButton,
		dom.formatLinkButton
	].forEach((button) => {
		button.addEventListener('mousedown', keepSelectionWhileClickingToolbar);
	});

	dom.formatBoldButton.addEventListener('click', () => {
		applyInlineFormatWithFeedback('bold');
	});

	dom.formatItalicButton.addEventListener('click', () => {
		applyInlineFormatWithFeedback('italic');
	});

	dom.formatUnderlineButton.addEventListener('click', () => {
		applyInlineFormatWithFeedback('underline');
	});

	dom.formatBulletListButton.addEventListener('click', () => {
		applyBulletListWithFeedback();
	});

	dom.formatTextSizeSelect.addEventListener('change', () => {
		applyTextSizeWithFeedback();
	});

	dom.formatTextColorApplyButton.addEventListener('click', () => {
		captureSelectionForColorControls();
		applyTextColorWithFeedback();
	});

	dom.formatTextColorPicker.addEventListener('input', () => {
		setPickerColor(dom.formatTextColorPicker.value, 'manual');
		applyTextColorWithFeedback(false);
	});

	dom.formatTextColorPicker.addEventListener('mousedown', () => {
		captureSelectionForColorControls();
		syncPickerFromSelection();
	});

	dom.formatTextColorPicker.addEventListener('focus', () => {
		captureSelectionForColorControls();
		syncPickerFromSelection();
	});

	dom.formatTextColorPicker.addEventListener('change', () => {
		setPickerColor(dom.formatTextColorPicker.value, 'manual');
		applyTextColorWithFeedback(false);
	});

	dom.formatLinkButton.addEventListener('click', () => {
		applyLinkWithFeedback();
	});

	document.addEventListener('selectionchange', syncPickerFromSelection);
	dom.resultPreview.addEventListener('mouseup', syncPickerFromSelection);
	dom.resultPreview.addEventListener('keyup', syncPickerFromSelection);
	dom.resultPreview.addEventListener('input', syncPickerFromSelection);

	syncPickerFromSelection();
};
