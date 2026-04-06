import type { CvTemplateId } from '../export-cv/cv-export';
import type { OptimizeCvProcessingMode } from '../llm-processing/ai-provider-types';

const PROCESSING_MODE_VALUES = [
	'text-direct',
	'pdf-native-input',
	'pdf-text-fallback'
] as const;

export interface HistoryEntry {
	id: string;
	createdAt: number;
	sourceFileName: string;
	safeFileName: string;
	format: string;
	inputSizeInBytes: number;
	inputFile?: File;
	summary: string;
	contentHash: string;
	optimizedHTML: string;
	primaryColor: string;
	templateId: CvTemplateId;
	targetPositions: string[];
	processingMode?: OptimizeCvProcessingMode;
	processingNotice?: string;
}

const normalizeTargetPosition = (value: string): string => {
	return value.trim().replace(/\s+/g, ' ');
};

const toTargetPositionKey = (value: string): string => {
	return value.toLocaleLowerCase('es-ES');
};

export const normalizeHistoryEntryProcessingMode = (
	value: unknown
): OptimizeCvProcessingMode | undefined => {
	if (typeof value !== 'string') {
		return undefined;
	}

	return PROCESSING_MODE_VALUES.find((candidate) => candidate === value);
};

export const normalizeHistoryEntryProcessingNotice = (
	value: unknown
): string | undefined => {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalizedValue = value.trim().replace(/\s+/g, ' ');
	return normalizedValue.length > 0 ? normalizedValue : undefined;
};

/**
 * Keeps browser-memory target positions stable across writes, reads, and UI
 * fallbacks so duplicated or malformed payloads do not erase the metadata.
 */
export const normalizeHistoryEntryTargetPositions = (value: unknown): string[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	const normalizedValues: string[] = [];
	const seen = new Set<string>();

	for (const entry of value) {
		if (typeof entry !== 'string') {
			continue;
		}

		const normalizedEntry = normalizeTargetPosition(entry);
		if (!normalizedEntry) {
			continue;
		}

		const entryKey = toTargetPositionKey(normalizedEntry);
		if (seen.has(entryKey)) {
			continue;
		}

		seen.add(entryKey);
		normalizedValues.push(normalizedEntry);
	}

	return normalizedValues;
};
