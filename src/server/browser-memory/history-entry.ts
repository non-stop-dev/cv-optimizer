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
