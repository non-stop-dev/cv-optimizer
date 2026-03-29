import { MAX_TEXT_CONTENT_LENGTH } from '../constants';
import { UploadSanitizationError } from '../errors';

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const normalizePlainText = (input: string): string => {
	return input
		.replace(/\r\n?/g, '\n')
		.replace(CONTROL_CHARACTERS, '')
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();
};

export const ensureContentWithinLimit = (
	content: string,
	formatLabel: string
): string => {
	const normalized = normalizePlainText(content);

	if (!normalized) {
		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: `No se pudo extraer contenido util del archivo ${formatLabel}.`
		});
	}

	if (normalized.length > MAX_TEXT_CONTENT_LENGTH) {
		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: `El contenido ${formatLabel} excede el limite permitido para procesamiento.`
		});
	}

	return normalized;
};
