import {
	applyInlineTextFormat,
	applyLinkOnSelection,
	captureSelectionRange,
	hasTextSelectionInsideEditor,
	restoreSelectionRange,
	type InlineTextFormat
} from '../text-editor/active-selection-formatting.client';
import type { OptimizerEditionStatusTone } from './optimizer-edition-editor-state.client';
import type { OptimizerEditionViewDom } from './optimizer-edition-view-dom.client';

interface BindOptimizerEditionFormatToolbarOptions {
	dom: Pick<
		OptimizerEditionViewDom,
		| 'resultPreview'
		| 'formatBoldButton'
		| 'formatItalicButton'
		| 'formatUnderlineButton'
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

	const keepSelectionWhileClickingToolbar = (event: MouseEvent): void => {
		event.preventDefault();
	};

	[
		dom.formatBoldButton,
		dom.formatItalicButton,
		dom.formatUnderlineButton,
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

	dom.formatLinkButton.addEventListener('click', () => {
		applyLinkWithFeedback();
	});
};
