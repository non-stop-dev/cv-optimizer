import type { CvTemplateId } from '../export-cv/cv-export';

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
}

const normalizeTargetPosition = (value: string): string => {
	return value.trim().replace(/\s+/g, ' ');
};

const toTargetPositionKey = (value: string): string => {
	return value.toLocaleLowerCase('es-ES');
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
