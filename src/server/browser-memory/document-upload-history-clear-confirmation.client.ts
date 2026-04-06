interface CreateDocumentUploadHistoryClearConfirmationOptions {
	dialog: HTMLDialogElement;
	confirmButton: HTMLButtonElement;
	cancelButton: HTMLButtonElement;
	onConfirm: () => Promise<void> | void;
}

interface DocumentUploadHistoryClearConfirmationController {
	open: () => void;
	close: () => void;
}

const showDialog = (dialog: HTMLDialogElement): void => {
	if (typeof dialog.showModal === 'function') {
		if (!dialog.open) {
			dialog.showModal();
		}
		return;
	}

	dialog.open = true;
};

const hideDialog = (dialog: HTMLDialogElement): void => {
	if (typeof dialog.close === 'function') {
		if (dialog.open) {
			dialog.close();
		}
		return;
	}

	dialog.open = false;
};

/**
 * Manages the confirmation modal shown before clearing upload history.
 */
export const createDocumentUploadHistoryClearConfirmationController = (
	options: CreateDocumentUploadHistoryClearConfirmationOptions
): DocumentUploadHistoryClearConfirmationController => {
	const { dialog, confirmButton, cancelButton, onConfirm } = options;
	let isBusy = false;

	const setBusy = (nextBusy: boolean): void => {
		isBusy = nextBusy;
		dialog.dataset.busy = nextBusy ? 'true' : 'false';
		confirmButton.disabled = nextBusy;
		cancelButton.disabled = nextBusy;
	};

	const close = (): void => {
		if (isBusy) {
			return;
		}

		hideDialog(dialog);
	};

	const open = (): void => {
		if (isBusy) {
			return;
		}

		showDialog(dialog);
	};

	cancelButton.addEventListener('click', close);

	dialog.addEventListener('cancel', (event) => {
		if (isBusy) {
			event.preventDefault();
			return;
		}

		hideDialog(dialog);
	});

	dialog.addEventListener('click', (event) => {
		if (isBusy || event.target !== dialog) {
			return;
		}

		hideDialog(dialog);
	});

	confirmButton.addEventListener('click', async () => {
		if (isBusy) {
			return;
		}

		setBusy(true);
		try {
			await onConfirm();
		} finally {
			setBusy(false);
			hideDialog(dialog);
		}
	});

	return {
		open,
		close
	};
};
