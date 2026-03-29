const TRANSLATION_TARGET_LANGUAGE = 'en';
const DEFAULT_BROWSER_TRANSLATION_SOURCE_LANGUAGE = 'es';
const MAX_LANGUAGE_DETECTION_TEXT_LENGTH = 4000;
const MIN_LANGUAGE_DETECTION_CONFIDENCE = 0.55;

export type TranslationCapability = 'browser-local-available' | 'llm-remote-only';

interface BrowserTranslatorInstance {
	translate: (input: string) => Promise<string>;
	ready?: Promise<void>;
	destroy?: () => void;
}

interface BrowserTranslatorApi {
	availability: (options: {
		sourceLanguage: string;
		targetLanguage: string;
	}) => Promise<string>;
	create: (options: {
		sourceLanguage: string;
		targetLanguage: string;
		monitor?: (monitor: EventTarget) => void;
	}) => Promise<BrowserTranslatorInstance>;
}

interface BrowserLanguageDetectionResult {
	detectedLanguage: string;
	confidence: number;
}

interface BrowserLanguageDetectorInstance {
	detect: (input: string) => Promise<BrowserLanguageDetectionResult[]>;
	ready?: Promise<void>;
	destroy?: () => void;
}

interface BrowserLanguageDetectorApi {
	availability: () => Promise<string>;
	create: (options?: {
		monitor?: (monitor: EventTarget) => void;
	}) => Promise<BrowserLanguageDetectorInstance>;
}

interface TranslateHtmlWithBrowserLocalApiOptions {
	safeHtml: string;
	onDownloadProgress?: (percentage: number) => void;
}

const isAvailabilityUsable = (availability: string): boolean => {
	const normalized = availability.trim().toLowerCase();
	return normalized === 'available' || normalized === 'downloadable' || normalized === 'downloading';
};

const normalizeLanguageTag = (languageTag: string): string => {
	return languageTag.trim().toLowerCase().split('-')[0] ?? '';
};

const getBrowserTranslatorApi = (): BrowserTranslatorApi | null => {
	const globalCandidate = globalThis as {
		Translator?: Partial<BrowserTranslatorApi>;
	};

	const translatorApi = globalCandidate.Translator;
	if (!translatorApi) {
		return null;
	}

	if (typeof translatorApi.availability !== 'function' || typeof translatorApi.create !== 'function') {
		return null;
	}

	return translatorApi as BrowserTranslatorApi;
};

const getBrowserLanguageDetectorApi = (): BrowserLanguageDetectorApi | null => {
	const globalCandidate = globalThis as {
		LanguageDetector?: Partial<BrowserLanguageDetectorApi>;
	};

	const detectorApi = globalCandidate.LanguageDetector;
	if (!detectorApi) {
		return null;
	}

	if (typeof detectorApi.availability !== 'function' || typeof detectorApi.create !== 'function') {
		return null;
	}

	return detectorApi as BrowserLanguageDetectorApi;
};

const collectTranslatableTextNodes = (root: Node): Text[] => {
	const ownerDocument = root.ownerDocument ?? document;
	const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];

	let currentNode: Node | null = walker.nextNode();
	while (currentNode) {
		if (currentNode instanceof Text) {
			const parentElement = currentNode.parentElement;
			const rawText = currentNode.textContent ?? '';
			if (rawText.trim().length > 0 && !(parentElement && parentElement.closest('.cv-placeholder'))) {
				textNodes.push(currentNode);
			}
		}

		currentNode = walker.nextNode();
	}

	return textNodes;
};

const preserveOuterWhitespace = (originalText: string, translatedText: string): string => {
	const leadingWhitespace = originalText.match(/^\s*/)?.[0] ?? '';
	const trailingWhitespace = originalText.match(/\s*$/)?.[0] ?? '';
	return `${leadingWhitespace}${translatedText.trim()}${trailingWhitespace}`;
};

const detectSourceLanguage = async (plainText: string): Promise<string | null> => {
	if (plainText.trim().length === 0) {
		return null;
	}

	const detectorApi = getBrowserLanguageDetectorApi();
	if (!detectorApi) {
		return null;
	}

	try {
		const availability = await detectorApi.availability();
		if (!isAvailabilityUsable(availability)) {
			return null;
		}

		const detector = await detectorApi.create();
		try {
			if (detector.ready instanceof Promise) {
				await detector.ready;
			}

			const detectionInput = plainText.slice(0, MAX_LANGUAGE_DETECTION_TEXT_LENGTH);
			const results = await detector.detect(detectionInput);
			if (!Array.isArray(results) || results.length === 0) {
				return null;
			}

			const topResult = results[0];
			if (!topResult || typeof topResult.detectedLanguage !== 'string') {
				return null;
			}

			if (
				typeof topResult.confidence === 'number' &&
				topResult.confidence < MIN_LANGUAGE_DETECTION_CONFIDENCE
			) {
				return null;
			}

			return normalizeLanguageTag(topResult.detectedLanguage);
		} finally {
			if (typeof detector.destroy === 'function') {
				detector.destroy();
			}
		}
	} catch {
		return null;
	}
};

export const detectBrowserTranslationCapability = async (): Promise<TranslationCapability> => {
	const translatorApi = getBrowserTranslatorApi();
	if (!translatorApi) {
		return 'llm-remote-only';
	}

	try {
		const availability = await translatorApi.availability({
			sourceLanguage: DEFAULT_BROWSER_TRANSLATION_SOURCE_LANGUAGE,
			targetLanguage: TRANSLATION_TARGET_LANGUAGE
		});

		if (isAvailabilityUsable(availability)) {
			return 'browser-local-available';
		}
	} catch {
		// Sin logging en cliente: el flujo usa fallback remoto silencioso.
	}

	return 'llm-remote-only';
};

export const translateHtmlWithBrowserLocalApi = async (
	options: TranslateHtmlWithBrowserLocalApiOptions
): Promise<string | null> => {
	const { safeHtml, onDownloadProgress } = options;
	const translatorApi = getBrowserTranslatorApi();
	if (!translatorApi) {
		return null;
	}

	const parsedDocument = new DOMParser().parseFromString(`<article>${safeHtml}</article>`, 'text/html');
	const container = parsedDocument.body.firstElementChild;
	if (!(container instanceof HTMLElement)) {
		return null;
	}

	const textNodes = collectTranslatableTextNodes(container);
	if (textNodes.length === 0) {
		return safeHtml;
	}

	const plainText = container.textContent?.trim() ?? '';
	const detectedLanguage = await detectSourceLanguage(plainText);
	const sourceLanguage = detectedLanguage || DEFAULT_BROWSER_TRANSLATION_SOURCE_LANGUAGE;

	if (normalizeLanguageTag(sourceLanguage) === TRANSLATION_TARGET_LANGUAGE) {
		return safeHtml;
	}

	try {
		const availability = await translatorApi.availability({
			sourceLanguage,
			targetLanguage: TRANSLATION_TARGET_LANGUAGE
		});
		if (!isAvailabilityUsable(availability)) {
			return null;
		}

		let translator: BrowserTranslatorInstance | null = null;
		try {
			translator = await translatorApi.create({
				sourceLanguage,
				targetLanguage: TRANSLATION_TARGET_LANGUAGE,
				monitor: (monitor) => {
					if (!onDownloadProgress) {
						return;
					}

					monitor.addEventListener('downloadprogress', (event: Event) => {
						const maybeLoaded = (event as { loaded?: unknown }).loaded;
						if (typeof maybeLoaded !== 'number') {
							return;
						}

						const progressPercentage = Math.round(Math.max(0, Math.min(1, maybeLoaded)) * 100);
						onDownloadProgress(progressPercentage);
					});
				}
			});

			if (translator.ready instanceof Promise) {
				await translator.ready;
			}

			for (const textNode of textNodes) {
				const originalText = textNode.textContent ?? '';
				const textToTranslate = originalText.trim();
				if (!textToTranslate) {
					continue;
				}

				const translatedText = await translator.translate(textToTranslate);
				textNode.textContent = preserveOuterWhitespace(originalText, translatedText);
			}

			return container.innerHTML;
		} finally {
			if (translator && typeof translator.destroy === 'function') {
				translator.destroy();
			}
		}
	} catch {
		return null;
	}
};
