// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDocumentUploadHistoryClearConfirmationController } from './document-upload-history-clear-confirmation.client';

const createDialogFixture = (): {
	dialog: HTMLDialogElement;
	confirmButton: HTMLButtonElement;
	cancelButton: HTMLButtonElement;
} => {
	document.body.innerHTML = `
		<dialog data-dialog>
			<button type="button" data-confirm>Si</button>
			<button type="button" data-cancel>No</button>
		</dialog>
	`;

	const dialog = document.querySelector('[data-dialog]') as HTMLDialogElement;
	const confirmButton = document.querySelector('[data-confirm]') as HTMLButtonElement;
	const cancelButton = document.querySelector('[data-cancel]') as HTMLButtonElement;

	dialog.showModal = vi.fn(() => {
		dialog.open = true;
	});
	dialog.close = vi.fn(() => {
		dialog.open = false;
	});

	return { dialog, confirmButton, cancelButton };
};

describe('createDocumentUploadHistoryClearConfirmationController', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('abre el dialogo y lo cierra cuando se cancela', () => {
		const { dialog, confirmButton, cancelButton } = createDialogFixture();
		const controller = createDocumentUploadHistoryClearConfirmationController({
			dialog,
			confirmButton,
			cancelButton,
			onConfirm: vi.fn()
		});

		controller.open();
		expect(dialog.open).toBe(true);

		cancelButton.click();
		expect(dialog.open).toBe(false);
	});

	it('ejecuta la confirmacion antes de cerrar el dialogo', async () => {
		const { dialog, confirmButton, cancelButton } = createDialogFixture();
		const onConfirm = vi.fn(async () => {
			await Promise.resolve();
		});
		const controller = createDocumentUploadHistoryClearConfirmationController({
			dialog,
			confirmButton,
			cancelButton,
			onConfirm
		});

		controller.open();
		confirmButton.click();

		expect(dialog.dataset.busy).toBe('true');
		expect(confirmButton.disabled).toBe(true);
		expect(cancelButton.disabled).toBe(true);

		await Promise.resolve();
		await Promise.resolve();

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(dialog.open).toBe(false);
		expect(dialog.dataset.busy).toBe('false');
		expect(confirmButton.disabled).toBe(false);
		expect(cancelButton.disabled).toBe(false);
	});
});
