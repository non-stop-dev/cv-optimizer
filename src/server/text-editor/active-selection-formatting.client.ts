export type InlineTextFormat = 'bold' | 'italic' | 'underline';

const getActiveSelection = (): Selection | null => {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
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

const hasActiveSelectionInsideEditor = (editor: HTMLElement): boolean => {
	const selection = getActiveSelection();
	if (!selection) {
		return false;
	}

	return (
		isNodeInsideEditor(editor, selection.anchorNode) &&
		isNodeInsideEditor(editor, selection.focusNode)
	);
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

const getActiveRangeWithinEditor = (editor: HTMLElement): Range | null => {
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

const findNearestFormatAncestor = (
	editor: HTMLElement,
	node: Node | null,
	wrapperTag: string
): HTMLElement | null => {
	let currentElement =
		node instanceof HTMLElement ? node : node?.parentElement ?? null;

	while (currentElement && currentElement !== editor) {
		if (currentElement.tagName.toLowerCase() === wrapperTag) {
			return currentElement;
		}

		currentElement = currentElement.parentElement;
	}

	return null;
};

const selectionCoversEntireElementContents = (
	range: Range,
	element: HTMLElement
): boolean => {
	const elementRange = document.createRange();
	elementRange.selectNodeContents(element);

	return (
		range.compareBoundaryPoints(Range.START_TO_START, elementRange) === 0 &&
		range.compareBoundaryPoints(Range.END_TO_END, elementRange) === 0
	);
};

const unwrapElementPreservingSelection = (element: HTMLElement): boolean => {
	const parent = element.parentNode;
	if (!parent) {
		return false;
	}

	const movedNodes = Array.from(element.childNodes);
	if (movedNodes.length === 0) {
		return false;
	}

	for (const child of movedNodes) {
		parent.insertBefore(child, element);
	}
	parent.removeChild(element);

	const selection = window.getSelection();
	if (selection) {
		selection.removeAllRanges();
		const nextRange = document.createRange();
		nextRange.setStartBefore(movedNodes[0]);
		nextRange.setEndAfter(movedNodes[movedNodes.length - 1]);
		selection.addRange(nextRange);
	}

	return true;
};

const toggleInlineTextFormat = (
	editor: HTMLElement,
	wrapperTag: string
): boolean => {
	const range = getActiveRangeWithinEditor(editor);
	if (!range) {
		return false;
	}

	const startAncestor = findNearestFormatAncestor(editor, range.startContainer, wrapperTag);
	const endAncestor = findNearestFormatAncestor(editor, range.endContainer, wrapperTag);

	if (!startAncestor || startAncestor !== endAncestor) {
		return false;
	}

	if (!selectionCoversEntireElementContents(range, startAncestor)) {
		return false;
	}

	return unwrapElementPreservingSelection(startAncestor);
};

const wrapActiveSelection = (
	editor: HTMLElement,
	createWrapper: () => HTMLElement
): boolean => {
	const range = getActiveRangeWithinEditor(editor);
	if (!range) {
		return false;
	}

	const extracted = range.extractContents();
	if (!extracted.textContent || extracted.textContent.trim().length === 0) {
		return false;
	}

	const wrapper = createWrapper();
	wrapper.append(extracted);
	range.insertNode(wrapper);

	const selection = window.getSelection();
	if (selection) {
		selection.removeAllRanges();
		const nextRange = document.createRange();
		nextRange.selectNodeContents(wrapper);
		selection.addRange(nextRange);
	}

	return true;
};

const normalizeLinkHref = (rawValue: string): string | null => {
	const trimmedValue = rawValue.trim();
	if (!trimmedValue) {
		return null;
	}

	const lowered = trimmedValue.toLowerCase();
	if (lowered.startsWith('javascript:') || lowered.startsWith('data:') || lowered.startsWith('vbscript:')) {
		return null;
	}

	if (/^(https?:|mailto:|tel:)/i.test(trimmedValue)) {
		return trimmedValue;
	}

	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
		return `mailto:${trimmedValue}`;
	}

	return `https://${trimmedValue}`;
};

export const applyInlineTextFormat = (editor: HTMLElement, action: InlineTextFormat): boolean => {
	const wrapperTag = action === 'bold' ? 'strong' : action === 'italic' ? 'em' : 'u';
	if (toggleInlineTextFormat(editor, wrapperTag)) {
		return true;
	}

	return wrapActiveSelection(editor, () => {
		return document.createElement(wrapperTag);
	});
};

export const applyLinkOnSelection = (editor: HTMLElement, rawHref: string): boolean => {
	const normalizedHref = normalizeLinkHref(rawHref);
	if (!normalizedHref) {
		return false;
	}

	return wrapActiveSelection(editor, () => {
		const link = document.createElement('a');
		link.href = normalizedHref;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		return link;
	});
};

export const hasTextSelectionInsideEditor = (editor: HTMLElement): boolean => {
	return hasActiveSelectionInsideEditor(editor);
};
