import YAML from 'yaml';

import { MAX_YAML_DEPTH } from '../constants';
import { UploadSanitizationError } from '../errors';
import { ensureContentWithinLimit, normalizePlainText } from './common';

type YamlPrimitive = string | number | boolean | null;
type YamlSanitizedValue = YamlPrimitive | YamlSanitizedValue[] | { [key: string]: YamlSanitizedValue };

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

const sanitizeYamlNode = (value: unknown, depth: number): YamlSanitizedValue => {
	if (depth > MAX_YAML_DEPTH) {
		throw new UploadSanitizationError({
			code: 'UNSAFE_CONTENT',
			statusCode: 422,
			message: 'El archivo YAML supera el nivel maximo de profundidad permitido.'
		});
	}

	if (typeof value === 'string') {
		return normalizePlainText(value);
	}

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw new UploadSanitizationError({
				code: 'UNSAFE_CONTENT',
				statusCode: 422,
				message: 'YAML contiene un valor numerico invalido.'
			});
		}
		return value;
	}

	if (typeof value === 'boolean' || value === null) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeYamlNode(item, depth + 1));
	}

	if (!isPlainObject(value)) {
		throw new UploadSanitizationError({
			code: 'UNSAFE_CONTENT',
			statusCode: 422,
			message: 'YAML contiene una estructura no permitida para procesamiento seguro.'
		});
	}

	const sanitizedObject: { [key: string]: YamlSanitizedValue } = {};
	for (const [rawKey, rawValue] of Object.entries(value)) {
		if (BLOCKED_KEYS.has(rawKey)) {
			throw new UploadSanitizationError({
				code: 'UNSAFE_CONTENT',
				statusCode: 422,
				message: `Se detecto una clave no permitida en YAML: ${rawKey}.`
			});
		}

		const safeKey = normalizePlainText(rawKey);
		if (!safeKey) {
			throw new UploadSanitizationError({
				code: 'UNSAFE_CONTENT',
				statusCode: 422,
				message: 'YAML contiene una clave vacia despues de sanitizacion.'
			});
		}

		sanitizedObject[safeKey] = sanitizeYamlNode(rawValue, depth + 1);
	}

	return sanitizedObject;
};

export const sanitizeYamlDocument = (rawYaml: string): string => {
	let parsedYaml: unknown;
	try {
		parsedYaml = YAML.parse(rawYaml, {
			maxAliasCount: 50,
			prettyErrors: true
		});
	} catch (error) {
		throw new UploadSanitizationError({
			code: 'PARSE_ERROR',
			statusCode: 422,
			message: 'No se pudo parsear el archivo YAML.',
			cause: error
		});
	}

	const sanitizedYaml = sanitizeYamlNode(parsedYaml, 0);
	const serializedYaml = YAML.stringify(sanitizedYaml);
	return ensureContentWithinLimit(serializedYaml, 'YAML');
};
