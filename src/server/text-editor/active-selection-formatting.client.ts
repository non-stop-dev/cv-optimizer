import {
	getActiveRangeWithinEditor,
	getCurrentRangeWithinEditor
} from './active-selection-range.client';

export type InlineTextFormat = 'bold' | 'italic' | 'underline';
export type TextSizeFormat =
	| 'cv-text-size-xs'
	| 'cv-text-size-sm'
	| 'cv-text-size-md'
	| 'cv-text-size-lg'
	| 'cv-text-size-xl';
export type TextColorFormat = string;

const TEXT_SIZE_CLASSES: ReadonlyArray<TextSizeFormat> = [
	'cv-text-size-xs',
	'cv-text-size-sm',
	'cv-text-size-md',
	'cv-text-size-lg',
	'cv-text-size-xl'
];

const CUSTOM_TEXT_COLOR_CLASS = 'cv-text-color-custom';

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

const unwrapExistingFormatWrappers = (
	editor: HTMLElement,
	range: Range,
	candidateClasses: readonly string[]
): void => {
	const wrapperNodes = Array.from(editor.querySelectorAll('span')).filter((node) =>
		candidateClasses.some((className) => node.classList.contains(className))
	);

	for (const wrapperNode of wrapperNodes) {
		if (
			range.intersectsNode(wrapperNode) &&
			selectionCoversEntireElementContents(range, wrapperNode)
		) {
			unwrapElementPreservingSelection(wrapperNode);
		}
	}
};

const unwrapExistingCustomColorWrappers = (editor: HTMLElement, range: Range): void => {
	const wrapperNodes = Array.from(
		editor.querySelectorAll<HTMLElement>(`span.${CUSTOM_TEXT_COLOR_CLASS}`)
	);

	for (const wrapperNode of wrapperNodes) {
		if (
			range.intersectsNode(wrapperNode) &&
			selectionCoversEntireElementContents(range, wrapperNode)
		) {
			unwrapElementPreservingSelection(wrapperNode);
		}
	}
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

const applySelectionClassFormat = (
	editor: HTMLElement,
	className: string,
	candidateClasses: readonly string[]
): boolean => {
	const range = getActiveRangeWithinEditor(editor);
	if (!range) {
		return false;
	}

	unwrapExistingFormatWrappers(editor, range, candidateClasses);

	return wrapActiveSelection(editor, () => {
		const wrapper = document.createElement('span');
		wrapper.classList.add(className);
		return wrapper;
	});
};

export const applyTextSizeFormat = (
	editor: HTMLElement,
	sizeClassName: TextSizeFormat
): boolean => {
	return applySelectionClassFormat(editor, sizeClassName, TEXT_SIZE_CLASSES);
};

export const applyTextColorFormat = (
	editor: HTMLElement,
	colorValue: TextColorFormat
): boolean => {
	const normalizedColorValue = colorValue.trim();
	if (!/^#(?:[0-9a-f]{6})$/i.test(normalizedColorValue)) {
		return false;
	}

	const range = getActiveRangeWithinEditor(editor);
	if (!range) {
		return false;
	}

	unwrapExistingCustomColorWrappers(editor, range);

	return wrapActiveSelection(editor, () => {
		const wrapper = document.createElement('span');
		wrapper.classList.add(CUSTOM_TEXT_COLOR_CLASS);
		wrapper.style.color = normalizedColorValue;
		return wrapper;
	});
};

const findNearestBlockElement = (editor: HTMLElement, node: Node | null): HTMLElement | null => {
	let currentElement =
		node instanceof HTMLElement ? node : node?.parentElement ?? null;

	while (currentElement && currentElement !== editor) {
		const tagName = currentElement.tagName.toLowerCase();
		if (tagName === 'p' || tagName === 'div' || tagName === 'li') {
			return currentElement;
		}

		currentElement = currentElement.parentElement;
	}

	return null;
};

const getSelectedBlockElements = (editor: HTMLElement, range: Range): HTMLElement[] => {
	if (range.collapsed) {
		const activeBlock = findNearestBlockElement(editor, range.startContainer);
		return activeBlock ? [activeBlock] : [];
	}

	const blockElements = Array.from(editor.querySelectorAll<HTMLElement>('p, div, li')).filter(
		(element) => {
		if (!range.intersectsNode(element)) {
			return false;
		}

		if (element.textContent?.trim().length === 0) {
			return false;
		}

		return !Array.from(element.children).some((child) => {
			if (!(child instanceof HTMLElement)) {
				return false;
			}

			const tagName = child.tagName.toLowerCase();
			return tagName === 'p' || tagName === 'div' || tagName === 'li';
		});
	});

	return blockElements;
};

const toggleBulletListWithNativeCommand = (editor: HTMLElement): boolean => {
	if (typeof document.execCommand !== 'function') {
		return false;
	}

	editor.focus();
	return document.execCommand('insertUnorderedList', false);
};

const unwrapListItemIntoParagraph = (listItem: HTMLElement): HTMLParagraphElement | null => {
	const listElement = listItem.parentElement;
	if (!listElement || (listElement.tagName !== 'UL' && listElement.tagName !== 'OL')) {
		return null;
	}

	const paragraph = document.createElement('p');
	paragraph.innerHTML = listItem.innerHTML;
	listElement.parentNode?.insertBefore(paragraph, listElement);
	listItem.remove();

	if (listElement.children.length === 0) {
		listElement.remove();
	}

	return paragraph;
};

const toggleBulletListWithFallback = (editor: HTMLElement): boolean => {
	const range = getCurrentRangeWithinEditor(editor);
	if (!range) {
		return false;
	}

	const selectedBlocks = getSelectedBlockElements(editor, range);
	if (selectedBlocks.length === 0) {
		return false;
	}

	if (selectedBlocks.every((block) => block.tagName.toLowerCase() === 'li')) {
		const convertedParagraphs = selectedBlocks
			.map((block) => unwrapListItemIntoParagraph(block))
			.filter((block): block is HTMLParagraphElement => block instanceof HTMLParagraphElement);

		if (convertedParagraphs.length === 0) {
			return false;
		}

		const selection = window.getSelection();
		if (selection) {
			selection.removeAllRanges();
			const nextRange = document.createRange();
			nextRange.setStartBefore(convertedParagraphs[0]);
			nextRange.setEndAfter(convertedParagraphs[convertedParagraphs.length - 1]);
			selection.addRange(nextRange);
		}

		return true;
	}

	const firstBlock = selectedBlocks[0];
	const listElement = document.createElement('ul');

	for (const block of selectedBlocks) {
		const listItem = document.createElement('li');
		listItem.innerHTML = block.innerHTML;
		listElement.appendChild(listItem);
	}

	firstBlock.parentNode?.insertBefore(listElement, firstBlock);
	for (const block of selectedBlocks) {
		block.remove();
	}

	const firstListItem = listElement.querySelector('li');
	const lastListItem = listElement.querySelector('li:last-child');
	if (!firstListItem || !lastListItem) {
		return false;
	}

	const selection = window.getSelection();
	if (selection) {
		selection.removeAllRanges();
		const nextRange = document.createRange();
		nextRange.setStartBefore(firstListItem);
		nextRange.setEndAfter(lastListItem);
		selection.addRange(nextRange);
	}

	return true;
};

export const toggleBulletListOnSelection = (editor: HTMLElement): boolean => {
	const range = getCurrentRangeWithinEditor(editor);
	if (!range || !findNearestBlockElement(editor, range.startContainer)) {
		return false;
	}

	if (toggleBulletListWithNativeCommand(editor)) {
		return true;
	}

	return toggleBulletListWithFallback(editor);
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
