import { sanitizeCvHtml } from '../llm-processing/cv-html-sanitizer';

interface TranslationSuccessPayload {
	ok: true;
	data: {
		translatedHTML: string;
	};
}

interface TranslationErrorPayload {
	ok: false;
	error?: {
		message?: string;
	};
}

type TranslationPayload = TranslationSuccessPayload | TranslationErrorPayload;

const isTranslationSuccessPayload = (
	payload: TranslationPayload | null
): payload is TranslationSuccessPayload => {
	return payload?.ok === true && typeof payload.data?.translatedHTML === 'string';
};

const extractTranslationErrorMessage = (payload: TranslationPayload | null): string => {
	if (payload && 'error' in payload && typeof payload.error?.message === 'string') {
		return payload.error.message;
	}

	return 'No se pudo traducir el CV al ingles en este momento.';
};

export const translateCvToEnglishWithLlmRemote = async (safeHtml: string): Promise<string> => {
	const response = await fetch('/api/translate', {
		method: 'POST',
		headers: {
			'content-type': 'application/json; charset=utf-8'
		},
		body: JSON.stringify({
			optimizedHTML: safeHtml
		})
	});

	const payload = (await response.json().catch(() => null)) as TranslationPayload | null;
	if (!response.ok || !isTranslationSuccessPayload(payload)) {
		throw new Error(extractTranslationErrorMessage(payload));
	}

	const safeTranslatedHtml = sanitizeCvHtml(payload.data.translatedHTML);
	if (!safeTranslatedHtml.trim()) {
		throw new Error('La traduccion no devolvio HTML util.');
	}

	return safeTranslatedHtml;
};
