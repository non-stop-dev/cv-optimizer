import {
	FORMAT_CONFIGURATIONS,
	MAX_UPLOAD_SIZE_BYTES
} from './constants';
import { UploadSanitizationError } from './errors';
import type {
	FormatConfiguration,
	SupportedDocumentFormat,
	UploadValidationContext
} from './types';

const FILE_NAME_SANITIZER = /[^a-zA-Z0-9._-]/g;

const extractExtension = (fileName: string): string | null => {
	const extensionIndex = fileName.lastIndexOf('.');
	if (extensionIndex < 0) {
		return null;
	}

	return fileName.slice(extensionIndex).toLowerCase();
};

const resolveConfigurationByExtension = (
	extension: string
): FormatConfiguration | undefined => {
	return FORMAT_CONFIGURATIONS.find((configuration) =>
		configuration.extensions.includes(extension)
	);
};

const isMimeAllowed = (
	configuration: FormatConfiguration,
	mimeType: string
): boolean => {
	if (!mimeType || mimeType === 'application/octet-stream') {
		return true;
	}

	return configuration.mimeTypes.includes(mimeType);
};

export const toSafeFileName = (fileName: string): string => {
	const cleanedName = fileName.trim().replace(FILE_NAME_SANITIZER, '_');
	return cleanedName.length > 0 ? cleanedName : 'documento_seguro';
};

export const assertUploadIsAllowed = (file: File): UploadValidationContext => {
	const originalName = typeof file.name === 'string' ? file.name : '';
	if (!originalName) {
		throw new UploadSanitizationError({
			code: 'MISSING_FILE',
			statusCode: 400,
			message: 'El archivo no incluye nombre valido.'
		});
	}

	if (file.size === 0) {
		throw new UploadSanitizationError({
			code: 'EMPTY_FILE',
			statusCode: 400,
			message: 'El archivo esta vacio. Usa un documento con contenido.'
		});
	}

	if (file.size > MAX_UPLOAD_SIZE_BYTES) {
		throw new UploadSanitizationError({
			code: 'FILE_TOO_LARGE',
			statusCode: 413,
			message: 'El archivo supera el limite maximo de 10 MB.'
		});
	}

	const extension = extractExtension(originalName);
	if (!extension) {
		throw new UploadSanitizationError({
			code: 'UNSUPPORTED_EXTENSION',
			statusCode: 415,
			message: 'El archivo debe incluir extension valida: .pdf, .html, .yaml, .yml o .txt.'
		});
	}

	const configuration = resolveConfigurationByExtension(extension);
	if (!configuration) {
		throw new UploadSanitizationError({
			code: 'UNSUPPORTED_EXTENSION',
			statusCode: 415,
			message: 'Formato no permitido. Usa PDF, HTML, YAML, YML o TXT.'
		});
	}

	const mimeType = file.type.trim().toLowerCase();
	if (!isMimeAllowed(configuration, mimeType)) {
		throw new UploadSanitizationError({
			code: 'UNSUPPORTED_MIME_TYPE',
			statusCode: 415,
			message: `El tipo MIME ${mimeType} no coincide con la extension ${extension}.`
		});
	}

	return {
		format: configuration.format as SupportedDocumentFormat,
		fileName: originalName,
		safeFileName: toSafeFileName(originalName),
		mimeType,
		sizeInBytes: file.size
	};
};
