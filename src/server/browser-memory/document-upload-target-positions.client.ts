const MAX_TARGET_POSITIONS = 3;
const MAX_TARGET_POSITION_LENGTH = 80;

interface CreateDocumentUploadTargetPositionsControllerOptions {
	input: HTMLInputElement;
	hiddenInput: HTMLInputElement;
	chips: HTMLElement;
	feedback: HTMLElement;
}

interface DocumentUploadTargetPositionsController {
	getValues: () => string[];
	setValues: (nextTargetPositions: string[]) => void;
	consumeCommaInput: () => void;
	flushPendingInput: () => void;
	removeAt: (index: number) => void;
	setBusy: (isBusy: boolean) => void;
	focusInput: () => void;
}

const normalizeTargetPosition = (value: string): string => {
	return value.trim().replace(/\s+/g, ' ');
};

const toTargetPositionKey = (value: string): string => {
	return value.toLocaleLowerCase('es-ES');
};

const toNormalizedUniqueTargetPositions = (values: string[]): string[] => {
	const uniqueTargetPositions: string[] = [];
	const seen = new Set<string>();

	for (const rawValue of values) {
		const normalizedValue = normalizeTargetPosition(rawValue);
		if (!normalizedValue) {
			continue;
		}

		const normalizedKey = toTargetPositionKey(normalizedValue);
		if (seen.has(normalizedKey)) {
			continue;
		}

		seen.add(normalizedKey);
		uniqueTargetPositions.push(normalizedValue);

		if (uniqueTargetPositions.length === MAX_TARGET_POSITIONS) {
			break;
		}
	}

	return uniqueTargetPositions;
};

/**
 * Normalizes target positions restored from backend payloads or browser-memory.
 */
export const toTargetPositionsFromPayload = (value: unknown): string[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	const asStrings = value.filter((entry): entry is string => typeof entry === 'string');
	return toNormalizedUniqueTargetPositions(asStrings);
};

/**
 * Owns the target-position chip input so upload flow orchestration stays small.
 */
export const createDocumentUploadTargetPositionsController = (
	options: CreateDocumentUploadTargetPositionsControllerOptions
): DocumentUploadTargetPositionsController => {
	const { input, hiddenInput, chips, feedback } = options;
	let targetPositions: string[] = [];
	let busy = false;

	const setFeedback = (message: string): void => {
		feedback.textContent = message;
	};

	const updateFeedback = (): void => {
		if (targetPositions.length === 0) {
			setFeedback('Puedes agregar hasta 3 posiciones.');
			return;
		}

		if (targetPositions.length >= MAX_TARGET_POSITIONS) {
			setFeedback('Llegaste al maximo de 3 posiciones.');
			return;
		}

		setFeedback(`${targetPositions.length} de ${MAX_TARGET_POSITIONS} posiciones agregadas.`);
	};

	const syncHiddenInput = (): void => {
		hiddenInput.value = JSON.stringify(targetPositions);
	};

	const renderChips = (): void => {
		chips.innerHTML = '';

		for (const [index, position] of targetPositions.entries()) {
			const item = document.createElement('li');
			item.dataset.targetPositionChip = '';

			const label = document.createElement('span');
			label.textContent = position;

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.dataset.targetPositionChipRemove = '';
			removeButton.dataset.targetPositionRemoveIndex = String(index);
			removeButton.ariaLabel = `Eliminar posicion ${position}`;
			removeButton.textContent = 'x';
			removeButton.disabled = busy;

			item.append(label, removeButton);
			chips.appendChild(item);
		}
	};

	const setValues = (nextTargetPositions: string[]): void => {
		targetPositions = toNormalizedUniqueTargetPositions(nextTargetPositions);
		renderChips();
		syncHiddenInput();
		updateFeedback();
	};

	const addTargetPosition = (rawValue: string): void => {
		const normalizedValue = normalizeTargetPosition(rawValue);
		if (!normalizedValue) {
			return;
		}

		if (normalizedValue.length > MAX_TARGET_POSITION_LENGTH) {
			setFeedback(`Cada posicion puede tener hasta ${MAX_TARGET_POSITION_LENGTH} caracteres.`);
			return;
		}

		const normalizedKey = toTargetPositionKey(normalizedValue);
		if (targetPositions.some((position) => toTargetPositionKey(position) === normalizedKey)) {
			setFeedback('Esa posicion ya esta agregada.');
			return;
		}

		if (targetPositions.length >= MAX_TARGET_POSITIONS) {
			setFeedback('Llegaste al maximo de 3 posiciones.');
			input.value = '';
			return;
		}

		setValues([...targetPositions, normalizedValue]);
	};

	const consumeCommaInput = (): void => {
		if (!input.value.includes(',')) {
			return;
		}

		const chunks = input.value.split(',');
		const pendingChunk = chunks.pop() ?? '';
		for (const chunk of chunks) {
			addTargetPosition(chunk);
		}

		if (targetPositions.length >= MAX_TARGET_POSITIONS) {
			input.value = '';
			return;
		}

		input.value = pendingChunk;
	};

	const flushPendingInput = (): void => {
		const pendingValue = normalizeTargetPosition(input.value);
		input.value = '';
		if (!pendingValue) {
			updateFeedback();
			return;
		}

		if (pendingValue.includes(',')) {
			for (const chunk of pendingValue.split(',')) {
				addTargetPosition(chunk);
			}
			return;
		}

		addTargetPosition(pendingValue);
	};

	const removeAt = (index: number): void => {
		if (!Number.isInteger(index) || index < 0 || index >= targetPositions.length) {
			return;
		}

		const nextPositions = [...targetPositions];
		nextPositions.splice(index, 1);
		setValues(nextPositions);
	};

	const setBusy = (isBusy: boolean): void => {
		busy = isBusy;
		input.disabled = isBusy;
		for (const removeButton of chips.querySelectorAll('[data-target-position-chip-remove]')) {
			if (removeButton instanceof HTMLButtonElement) {
				removeButton.disabled = isBusy;
			}
		}
	};

	const focusInput = (): void => {
		input.focus();
	};

	return {
		getValues: () => [...targetPositions],
		setValues,
		consumeCommaInput,
		flushPendingInput,
		removeAt,
		setBusy,
		focusInput
	};
};
