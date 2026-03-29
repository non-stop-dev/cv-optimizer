// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	readHistoryEntryById: vi.fn(),
	upsertHistoryEntry: vi.fn(),
	applyPreviewPrimaryColor: vi.fn(),
	downloadTextFile: vi.fn()
}));

vi.mock('./history-db', () => ({
	readHistoryEntryById: mocks.readHistoryEntryById,
	upsertHistoryEntry: mocks.upsertHistoryEntry
}));

vi.mock('../llm-processing/cv-html-sanitizer', () => ({
	sanitizeCvHtml: (html: string) => html
}));

vi.mock('../export-cv/cv-preview-color', () => ({
	createPreviewColorApplicator: () => mocks.applyPreviewPrimaryColor,
	isValidHexColor: (value: string) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}));

vi.mock('../export-cv/cv-export', () => ({
	toSafeFileName: (sourceName: string, extension: string) => `${sourceName}.${extension}`,
	downloadTextFile: mocks.downloadTextFile,
	buildHtmlExportDocument: () => '<html></html>',
	buildPrintableHtml: () => '<html></html>',
	openPrintPreview: () => true
}));

const buildEditionDom = (): void => {
	document.body.innerHTML = `
		<div data-output-root data-entry-id="entry-1">
			<aside data-output-status hidden>
				<h3 data-output-status-title></h3>
				<p data-output-status-message></p>
			</aside>
			<div>
				<p data-output-meta></p>
				<p data-output-save-indicator data-state="idle"></p>
			</div>
			<section data-output-result hidden>
				<input data-cv-primary-color value="#0f766e" />
				<button data-cv-undo type="button"></button>
				<button data-cv-redo type="button"></button>
				<button data-cv-export-html type="button"></button>
				<button data-cv-export-txt type="button"></button>
				<button data-cv-export-pdf type="button"></button>
				<div data-output-preview contenteditable="true"></div>
				<pre data-output-raw></pre>
			</section>
		</div>
	`;
};

const flushAsync = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

const loadClientModule = async (): Promise<void> => {
	vi.resetModules();
	await import('./optimizer-edition-view.client');
	await flushAsync();
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	buildEditionDom();
	mocks.readHistoryEntryById.mockResolvedValue({
		id: 'entry-1',
		createdAt: Date.now(),
		sourceFileName: 'cv-test.pdf',
		safeFileName: 'cv-test.pdf',
		format: 'pdf',
		inputSizeInBytes: 1024,
		summary: 'Resumen',
		contentHash: 'hash',
		optimizedHTML: '<p>Original</p>',
		primaryColor: '#0f766e'
	});
	mocks.upsertHistoryEntry.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('optimizer-edition-view client flow', () => {
	it('carga la version y deja el estado en autoguardado listo', async () => {
		await loadClientModule();

		const outputMeta = document.querySelector('[data-output-meta]');
		const saveIndicator = document.querySelector('[data-output-save-indicator]');
		const undoButton = document.querySelector('[data-cv-undo]') as HTMLButtonElement;
		const redoButton = document.querySelector('[data-cv-redo]') as HTMLButtonElement;

		expect(outputMeta?.textContent).toContain('Version: cv-test.pdf');
		expect(saveIndicator?.textContent).toBe('Autoguardado');
		expect(undoButton.disabled).toBe(true);
		expect(redoButton.disabled).toBe(true);
	});

	it('guarda cambios con debounce y soporta undo/redo por teclado', async () => {
		await loadClientModule();

		const preview = document.querySelector('[data-output-preview]') as HTMLElement;
		const saveIndicator = document.querySelector('[data-output-save-indicator]');
		const undoButton = document.querySelector('[data-cv-undo]') as HTMLButtonElement;

		preview.innerHTML = '<p>Editado</p>';
		preview.dispatchEvent(new Event('input', { bubbles: true }));
		expect(saveIndicator?.textContent).toBe('Guardando cambios...');

		vi.advanceTimersByTime(220);
		await flushAsync();
		vi.advanceTimersByTime(500);
		await flushAsync();

		expect(mocks.upsertHistoryEntry).toHaveBeenCalledTimes(1);
		expect(mocks.upsertHistoryEntry).toHaveBeenLastCalledWith(
			expect.objectContaining({
				optimizedHTML: '<p>Editado</p>',
				primaryColor: '#0f766e'
			})
		);
		expect(saveIndicator?.textContent).toBe('Autoguardado');
		expect(undoButton.disabled).toBe(false);

		preview.focus();
		preview.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'z',
				ctrlKey: true,
				bubbles: true
			})
		);
		expect(preview.innerHTML).toBe('<p>Original</p>');

		preview.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'y',
				ctrlKey: true,
				bubbles: true
			})
		);
		expect(preview.innerHTML).toBe('<p>Editado</p>');
	});

	it('hace flush de autoguardado en visibilitychange hidden', async () => {
		await loadClientModule();

		const preview = document.querySelector('[data-output-preview]') as HTMLElement;
		preview.innerHTML = '<p>Cambio pendiente</p>';
		preview.dispatchEvent(new Event('input', { bubbles: true }));

		expect(mocks.upsertHistoryEntry).not.toHaveBeenCalled();

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'hidden'
		});
		document.dispatchEvent(new Event('visibilitychange'));
		await flushAsync();

		expect(mocks.upsertHistoryEntry).toHaveBeenCalledWith(
			expect.objectContaining({ optimizedHTML: '<p>Cambio pendiente</p>' })
		);
	});
});
