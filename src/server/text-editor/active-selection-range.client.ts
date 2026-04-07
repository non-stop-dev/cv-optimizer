const getActiveSelection = (): Selection | null => {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		return null;
	}

	return selection;
};

const getCurrentSelection = (): Selection | null => {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return null;
	}

	return selection;
};

const isNodeInsideEditor = (editor: HTMLElement, node: Node | null): boolean => {
	if (!node) {
		return false;
	}

	return editor.contains(node);
};

export const captureSelectionRange = (editor: HTMLElement): Range | null => {
	const selection = getActiveSelection();
	if (!selection) {
		return null;
	}

	if (
		!isNodeInsideEditor(editor, selection.anchorNode) ||
		!isNodeInsideEditor(editor, selection.focusNode)
	) {
		return null;
	}

	return selection.getRangeAt(0).cloneRange();
};

export const restoreSelectionRange = (range: Range | null): boolean => {
	if (!range) {
		return false;
	}

	const selection = window.getSelection();
	if (!selection) {
		return false;
	}

	selection.removeAllRanges();
	selection.addRange(range);
	return true;
};

export const getActiveRangeWithinEditor = (editor: HTMLElement): Range | null => {
	const selection = getActiveSelection();
	if (!selection) {
		return null;
	}

	if (
		!isNodeInsideEditor(editor, selection.anchorNode) ||
		!isNodeInsideEditor(editor, selection.focusNode)
	) {
		return null;
	}

	const range = selection.getRangeAt(0);
	if (range.collapsed || range.toString().trim().length === 0) {
		return null;
	}

	return range;
};

export const getCurrentRangeWithinEditor = (editor: HTMLElement): Range | null => {
	const selection = getCurrentSelection();
	if (!selection) {
		return null;
	}

	if (
		!isNodeInsideEditor(editor, selection.anchorNode) ||
		!isNodeInsideEditor(editor, selection.focusNode)
	) {
		return null;
	}

	return selection.getRangeAt(0);
};

export const hasTextSelectionInsideEditor = (editor: HTMLElement): boolean => {
	const selection = getActiveSelection();
	if (!selection) {
		return false;
	}

	return (
		isNodeInsideEditor(editor, selection.anchorNode) &&
		isNodeInsideEditor(editor, selection.focusNode)
	);
};

export const hasCursorInsideEditor = (editor: HTMLElement): boolean => {
	const selection = getCurrentSelection();
	if (!selection) {
		return false;
	}

	return (
		isNodeInsideEditor(editor, selection.anchorNode) &&
		isNodeInsideEditor(editor, selection.focusNode)
	);
};
