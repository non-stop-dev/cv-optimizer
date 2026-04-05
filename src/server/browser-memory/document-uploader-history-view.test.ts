// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { renderHistoryList } from './document-uploader-history-view';
import type { HistoryEntry } from './history-entry';

const createHistoryEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
	id: 'entry-1',
	createdAt: new Date('2026-03-30T00:56:00Z').getTime(),
	sourceFileName: 'cv.pdf',
	safeFileName: 'cv.pdf',
	format: 'pdf',
	inputSizeInBytes: 149_700,
	summary: 'Resumen',
	contentHash: 'hash-1',
	optimizedHTML: '<p>CV</p>',
	primaryColor: '#0f766e',
	templateId: 'default',
	targetPositions: [],
	...overrides
});

describe('renderHistoryList', () => {
	it('muestra las posiciones objetivo registradas en una linea dedicada', () => {
		document.body.innerHTML = `
			<p data-empty></p>
			<button data-clear type="button"></button>
			<ul data-list></ul>
		`;

		const historyList = document.querySelector('[data-list]') as HTMLElement;
		const historyEmpty = document.querySelector('[data-empty]') as HTMLElement;
		const historyClearButton = document.querySelector('[data-clear]') as HTMLButtonElement;

		renderHistoryList({
			historyList,
			historyEmpty,
			historyClearButton,
			entries: [
				createHistoryEntry({
					targetPositions: ['Recepcionista de hotel', 'Front Desk']
				})
			]
		});

		const infoNodes = Array.from(historyList.querySelectorAll('[data-history-info]'));
		expect(infoNodes[1]?.textContent).toBe(
			'Optimizado para: Recepcionista de hotel, Front Desk'
		);
	});

	it('deja la metadata en blanco cuando la version no tiene posiciones objetivo', () => {
		document.body.innerHTML = `
			<p data-empty></p>
			<button data-clear type="button"></button>
			<ul data-list></ul>
		`;

		const historyList = document.querySelector('[data-list]') as HTMLElement;
		const historyEmpty = document.querySelector('[data-empty]') as HTMLElement;
		const historyClearButton = document.querySelector('[data-clear]') as HTMLButtonElement;

		renderHistoryList({
			historyList,
			historyEmpty,
			historyClearButton,
			entries: [createHistoryEntry({ targetPositions: [] })]
		});

		const infoNodes = Array.from(historyList.querySelectorAll('[data-history-info]'));
		expect(infoNodes).toHaveLength(1);
		expect(infoNodes[0]?.textContent).toContain('PDF');
	});
});
