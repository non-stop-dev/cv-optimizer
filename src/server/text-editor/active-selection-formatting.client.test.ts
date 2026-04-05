// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
	applyInlineTextFormat,
	type InlineTextFormat
} from './active-selection-formatting.client';

const selectNodeContents = (node: Node): void => {
	const selection = window.getSelection();
	if (!selection) {
		throw new Error('Selection API no disponible.');
	}

	const range = document.createRange();
	range.selectNodeContents(node);
	selection.removeAllRanges();
	selection.addRange(range);
};

describe('applyInlineTextFormat', () => {
	it.each([
		['bold', 'strong'],
		['italic', 'em'],
		['underline', 'u']
	] as const)(
		'permite aplicar y deshacer %s cuando se vuelve a seleccionar el mismo texto',
		(format: InlineTextFormat, tagName: string) => {
			document.body.innerHTML = '<div contenteditable="true"><p>Texto editable</p></div>';
			const editor = document.querySelector('div') as HTMLElement;
			const paragraph = editor.querySelector('p') as HTMLElement;

			selectNodeContents(paragraph.firstChild as Node);
			expect(applyInlineTextFormat(editor, format)).toBe(true);
			expect(editor.querySelector(tagName)?.textContent).toBe('Texto editable');

			selectNodeContents(editor.querySelector(tagName) as Node);
			expect(applyInlineTextFormat(editor, format)).toBe(true);
			expect(editor.querySelector(tagName)).toBeNull();
			expect(editor.textContent).toContain('Texto editable');
		}
	);
});
