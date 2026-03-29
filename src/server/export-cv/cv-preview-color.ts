const findPreviewRule = (rules: CSSRuleList, selector: string): CSSStyleRule | null => {
	for (const rule of Array.from(rules)) {
		if (rule instanceof CSSStyleRule && rule.selectorText === selector) {
			return rule;
		}

		if (rule instanceof CSSGroupingRule) {
			const nested = findPreviewRule(rule.cssRules, selector);
			if (nested) {
				return nested;
			}
		}
	}

	return null;
};

export const isValidHexColor = (value: string): boolean => {
	return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
};

export const createPreviewColorApplicator = (
	selector: string,
	fallbackColor: string
): ((requestedColor: string) => void) => {
	let cachedPreviewRule: CSSStyleRule | null = null;

	const getPreviewRule = (): CSSStyleRule | null => {
		if (cachedPreviewRule instanceof CSSStyleRule) {
			return cachedPreviewRule;
		}

		for (const styleSheet of Array.from(document.styleSheets)) {
			try {
				const foundRule = findPreviewRule(styleSheet.cssRules, selector);
				if (foundRule instanceof CSSStyleRule) {
					cachedPreviewRule = foundRule;
					return cachedPreviewRule;
				}
			} catch {
				// Ignore non-readable cross-origin stylesheets.
			}
		}

		return null;
	};

	return (requestedColor: string): void => {
		const safeColor = isValidHexColor(requestedColor) ? requestedColor : fallbackColor;
		const previewRule = getPreviewRule();
		if (!(previewRule instanceof CSSStyleRule)) {
			console.warn('No se pudo aplicar el color del preview: regla CSS no disponible.');
			return;
		}

		previewRule.style.setProperty('--cv-primary', safeColor);
	};
};
