// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
	applyInlineTextFormat,
	applyTextColorFormat,
	applyTextSizeFormat,
	toggleBulletListOnSelection,
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

describe('selection class formatting', () => {
	it('aplica clases de tamaño sobre el texto seleccionado', () => {
		document.body.innerHTML = '<div contenteditable="true"><p>Texto editable</p></div>';
		const editor = document.querySelector('div') as HTMLElement;
		const paragraph = editor.querySelector('p') as HTMLElement;

		selectNodeContents(paragraph.firstChild as Node);
		expect(applyTextSizeFormat(editor, 'cv-text-size-lg')).toBe(true);
		expect(editor.querySelector('.cv-text-size-lg')?.textContent).toBe('Texto editable');
	});

	it('aplica color inline sobre el texto seleccionado', () => {
		document.body.innerHTML = '<div contenteditable="true"><p>Texto editable</p></div>';
		const editor = document.querySelector('div') as HTMLElement;
		const paragraph = editor.querySelector('p') as HTMLElement;

		selectNodeContents(paragraph.firstChild as Node);
		expect(applyTextColorFormat(editor, '#ff6600')).toBe(true);
		const colorWrapper = editor.querySelector('.cv-text-color-custom') as HTMLElement | null;
		expect(colorWrapper?.textContent).toBe('Texto editable');
		expect(colorWrapper?.style.color).toBe('rgb(255, 102, 0)');
	});
});

describe('toggleBulletListOnSelection', () => {
	it('convierte un bloque en lista con bullet', () => {
		document.body.innerHTML = '<div contenteditable="true"><p>Elemento editable</p></div>';
		const editor = document.querySelector('div') as HTMLElement;
		const paragraph = editor.querySelector('p') as HTMLElement;

		selectNodeContents(paragraph.firstChild as Node);
		expect(toggleBulletListOnSelection(editor)).toBe(true);
		expect(editor.querySelector('ul li')?.textContent).toBe('Elemento editable');
	});

	it('deshace una lista simple a parrafo', () => {
		document.body.innerHTML = '<div contenteditable="true"><ul><li>Elemento editable</li></ul></div>';
		const editor = document.querySelector('div') as HTMLElement;
		const listItem = editor.querySelector('li') as HTMLElement;

		selectNodeContents(listItem.firstChild as Node);
		expect(toggleBulletListOnSelection(editor)).toBe(true);
		expect(editor.querySelector('ul')).toBeNull();
		expect(editor.querySelector('p')?.textContent).toBe('Elemento editable');
	});

	it('convierte varios bloques seleccionados en una lista con varios items', () => {
		document.body.innerHTML =
			'<div contenteditable="true"><p>Uno</p><p>Dos</p><p>Tres</p></div>';
		const editor = document.querySelector('div') as HTMLElement;
		const paragraphs = editor.querySelectorAll('p');
		const selection = window.getSelection();
		if (!selection) {
			throw new Error('Selection API no disponible.');
		}

		const range = document.createRange();
		range.setStart(paragraphs[0].firstChild as Node, 0);
		range.setEnd(paragraphs[1].firstChild as Node, 'Dos'.length);
		selection.removeAllRanges();
		selection.addRange(range);

		expect(toggleBulletListOnSelection(editor)).toBe(true);
		expect(Array.from(editor.querySelectorAll('ul li')).map((item) => item.textContent)).toEqual([
			'Uno',
			'Dos'
		]);
		expect(editor.querySelectorAll('p')).toHaveLength(1);
	});

	it('convierte solo el bloque actual cuando hay cursor sin seleccion', () => {
		document.body.innerHTML =
			'<div contenteditable="true"><p>Uno</p><p>Dos</p><p>Tres</p></div>';
		const editor = document.querySelector('div') as HTMLElement;
		const secondParagraphText = editor.querySelectorAll('p')[1].firstChild as Node;
		const selection = window.getSelection();
		if (!selection) {
			throw new Error('Selection API no disponible.');
		}

		const range = document.createRange();
		range.setStart(secondParagraphText, 1);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);

		expect(toggleBulletListOnSelection(editor)).toBe(true);
		expect(Array.from(editor.querySelectorAll('ul li')).map((item) => item.textContent)).toEqual([
			'Dos'
		]);
		expect(Array.from(editor.querySelectorAll('p')).map((item) => item.textContent)).toEqual([
			'Uno',
			'Tres'
		]);
	});
});
